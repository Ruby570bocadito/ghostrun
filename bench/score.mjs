// Scores one analysed run against the known answer for its game variant.
import { intersects } from '../src/analyze.mjs';

// Which detected finding types count as "the right kind" for each kind of injected fault.
export const COMPATIBLE = {
  blocker: ['blocker', 'stuck', 'missed'],
  missed: ['missed', 'stuck'],
  deaths: ['blocker', 'friction'],
  confusion: ['confusion', 'blocker', 'friction', 'stuck', 'missed'],
};
export const ALARM_TYPES = ['blocker', 'missed', 'stuck'];

/**
 * @param {object} report  output of analyze()
 * @param {object|null} fault  entry of games/<id>/faults.json, or null for the clean version
 */
export function score(report, fault) {
  const findings = report.findings.filter((f) => f.severity !== 'low');
  const finished = report.ghosts.filter((g) => g.outcome === 'won').length;
  if (!fault) {
    const alarms = findings.filter((f) => ALARM_TYPES.includes(f.type) && f.severity === 'high');
    return { kind: 'clean', finished, falseAlarms: alarms.length, alarmTypes: alarms.map((a) => a.type), friction: findings.filter((f) => f.type === 'friction').length };
  }
  const inRegion = findings.filter((f) => intersects(f.region, fault.region) || (fault.milestone && f.milestone === fault.milestone));
  const strict = inRegion.filter((f) => COMPATIBLE[fault.type].includes(f.type));
  const rank = strict.length ? report.findings.indexOf(strict[0]) + 1 : null;
  const elsewhere = findings.filter((f) => !inRegion.includes(f) && ALARM_TYPES.includes(f.type) && f.severity === 'high');
  return { kind: 'fault', finished, detected: inRegion.length > 0, detectedStrict: strict.length > 0, matched: inRegion.map((f) => f.type), rank, otherAlarms: elsewhere.length };
}
