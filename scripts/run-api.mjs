// Starts a run through the app server's API and waits for it to finish (for demos and checks).
// node scripts/run-api.mjs '<json body>'   e.g. '{"url":"http://localhost:5174/gap-run/?fault=gap","simulateOutage":true}'
const base = process.env.APP_URL ?? 'http://localhost:5180';
const body = JSON.parse(process.argv[2] ?? '{}');
const res = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const started = await res.json();
if (!res.ok) {
  console.log(`refused (${res.status}): ${started.message ?? started.error}`);
  process.exit(0);
}
console.log(`run ${started.id} started`);
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await (await fetch(`${base}/api/runs/${started.id}`)).json();
  if (s.status === 'done' || s.status === 'failed') {
    const r = s.report;
    if (!r) {
      console.log(`${s.status}: no report`);
      break;
    }
    if (r.failure) console.log(`failed safely: ${r.failure.kind} — ${r.failure.message} · cost $${r.cost?.total?.toFixed(4)}`);
    else {
      console.log(`${s.status}: ${(r.findings ?? []).length} findings, ${r.ghosts.filter((g) => g.outcome === 'won').length}/${r.ghostsTotal} finished, cost $${r.cost.total.toFixed(4)}, ${Math.round(r.realMs / 1000)} s`);
      for (const f of r.findings ?? []) console.log(`  ${f.id} ${f.type}${f.severity === 'high' ? '!' : ''} ${f.ghosts.length}/${r.ghostsTotal} at (${f.center.x},${f.center.y})`);
      for (const n of r.notices ?? []) console.log(`  notice: ${n.persona} ${n.from} -> ${n.to} at move ${n.step} (${n.simulated ? 'simulated' : 'real'}: ${n.reason})`);
    }
    console.log(`report: ${base}/#/run/${started.id}`);
    break;
  }
}
