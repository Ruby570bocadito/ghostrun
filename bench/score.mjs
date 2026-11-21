// Scores one analysed run against the known answer for its game variant.
import { intersects } from '../src/analyze.mjs';

// Which detected finding types count as "the right kind" for each kind of injected fault.
export const COMPATIBLE = {
  blocker: ['blocker', 'stuck', 'missed'],
  // A planted 'missed' objective is an object players cannot find; its measured low contrast names the cause.
  missed: ['missed', 'stuck', 'hard_to_see'],
  deaths: ['blocker', 'friction'],
  confusion: ['confusion', 'blocker', 'friction', 'stuck', 'missed'],
};
export const ALARM_TYPES = ['blocker', 'missed', 'stuck', 'hard_to_see'];

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
  // Found = a CRITICAL finding of a compatible type in the flaw's place: the same set (high-severity blocker,
  // missed objective, stuck, hard to see) that makes a false alarm on a clean game. Until 21 Nov night a
  // friction finding also counted, but friction appears at the same spots in the clean versions of 2 of our
  // 5 games, so it did not tell the flawed version from the clean one (found by a review agent).
  const strict = inRegion.filter((f) => COMPATIBLE[fault.type].includes(f.type) && ALARM_TYPES.includes(f.type) && f.severity === 'high');
  const lenient = inRegion.filter((f) => COMPATIBLE[fault.type].includes(f.type));
  const rank = strict.length ? report.findings.indexOf(strict[0]) + 1 : null;
  const elsewhere = findings.filter((f) => !inRegion.includes(f) && ALARM_TYPES.includes(f.type) && f.severity === 'high');
  return { kind: 'fault', finished, detected: inRegion.length > 0, detectedLenient: lenient.length > 0, detectedStrict: strict.length > 0, matched: inRegion.map((f) => f.type), rank, otherAlarms: elsewhere.length };
}
