// Tests for the public-demo protections (src/guard.mjs). No network: DNS is faked.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, checkTarget, clientIp, createRequestGuard, isPrivateAddress } from '../src/guard.mjs';

test('private, local and special addresses are recognised; public ones are not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
  assert.equal(isPrivateAddress('not-an-ip'), true);
});

test('links to the server\'s own network are refused, our test games and public sites are not', async () => {
  const resolve = async (host) => {
    const table = { 'localhost': ['127.0.0.1'], 'game.example': ['93.184.216.34'], 'sneaky.example': ['93.184.216.34', '10.0.0.5'] };
    if (!table[host]) throw new Error('ENOTFOUND');
    return table[host].map((address) => ({ address }));
  };
  const allowHosts = ['localhost:5174'];
  assert.deepEqual(await checkTarget('http://localhost:5174/gap-run/', { allowHosts, resolve }), { ok: true });
  assert.deepEqual(await checkTarget('https://game.example/play', { allowHosts, resolve }), { ok: true });
  assert.equal((await checkTarget('http://localhost:8080/admin', { allowHosts, resolve })).reason, 'private_address');
  assert.equal((await checkTarget('http://169.254.169.254/latest/meta-data/', { allowHosts, resolve })).reason, 'private_address');
  assert.equal((await checkTarget('http://[::1]:3000/', { allowHosts, resolve })).reason, 'private_address');
  assert.equal((await checkTarget('http://2130706433/', { allowHosts, resolve })).reason, 'private_address'); // 127.0.0.1 written as a number
  assert.equal((await checkTarget('http://sneaky.example/', { allowHosts, resolve })).reason, 'private_address'); // one private answer is enough
  assert.equal((await checkTarget('http://nowhere.example/', { allowHosts, resolve })).reason, 'unresolvable');
  assert.equal((await checkTarget('file:///etc/passwd', { allowHosts, resolve })).reason, 'invalid_url');
});

test('the in-page guard caches its answer per host', async () => {
  let lookups = 0;
  const resolve = async () => {
    lookups += 1;
    return [{ address: '93.184.216.34' }];
  };
  const guard = createRequestGuard({ resolve });
  assert.equal(await guard('https://cdn.example/a.js'), true);
  assert.equal(await guard('https://cdn.example/b.png'), true);
  assert.equal(lookups, 1);
  assert.equal(await guard('data:image/png;base64,AAAA'), true);
  assert.equal(await guard('http://127.0.0.1:9999/secret'), false);
});

test('rate limits count per visitor within the window', () => {
  const limiter = new RateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.take('a', 0).ok, true);
  assert.equal(limiter.take('a', 100).ok, true);
  const third = limiter.take('a', 200);
  assert.equal(third.ok, false);
  assert.equal(third.retryAfterMs, 800);
  assert.equal(limiter.take('b', 200).ok, true); // someone else is not affected
  assert.equal(limiter.take('a', 1001).ok, true); // the first hit left the window
});

test('the visitor address comes from the proxy header only when the proxy is trusted', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, socket: { remoteAddress: '10.0.0.1' } };
  assert.equal(clientIp(req, false), '10.0.0.1');
  assert.equal(clientIp(req, true), '203.0.113.7');
});
