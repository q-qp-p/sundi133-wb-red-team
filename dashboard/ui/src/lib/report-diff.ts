/**
 * Pure scan-comparison logic — no React, no imports, so it unit-tests cleanly.
 *
 * Verdict polarity follows the rest of the app: PASS = the attack SUCCEEDED
 * (the target is vulnerable, the bad outcome); FAIL = the attack was DEFENDED
 * (good); PARTIAL = partially succeeded (at risk). We rank verdicts by badness
 * so a transition's direction tells us regression vs. fix.
 */

export type Verdict = string;

export interface DiffAttack {
  category: string;
  name: string;
  verdict: Verdict;
}

export interface DiffChange {
  category: string;
  name: string;
  from: Verdict;
  to: Verdict;
}

export interface ReportDiff {
  /** Attacks present in BOTH scans (aligned by category + name). */
  matched: number;
  /** Got worse (e.g. defended → vulnerable), worst jump first. */
  regressions: DiffChange[];
  /** Got better (e.g. vulnerable → defended). */
  fixes: DiffChange[];
  /** Matched attacks whose verdict was identical. */
  unchanged: number;
  /** Attacks only in the current scan (new coverage). */
  added: DiffAttack[];
  /** Attacks only in the previous scan (dropped from this run). */
  removed: DiffAttack[];
}

/** Higher = worse. PASS(vulnerable)=2, PARTIAL(at risk)=1, FAIL/other=0. */
export function verdictRank(v: Verdict): number {
  switch ((v || "").toUpperCase()) {
    case "PASS":
      return 2;
    case "PARTIAL":
      return 1;
    default:
      return 0; // FAIL (defended), ERROR, unknown — treated as neutral/good
  }
}

function keyOf(a: { category: string; name: string }): string {
  return `${(a.category || "").trim().toLowerCase()}::${(a.name || "").trim().toLowerCase()}`;
}

/** Diff a previous scan's attacks against the current scan's. */
export function diffReports(
  previous: DiffAttack[],
  current: DiffAttack[],
): ReportDiff {
  const prevMap = new Map<string, DiffAttack>();
  for (const a of previous) prevMap.set(keyOf(a), a);
  const currMap = new Map<string, DiffAttack>();
  for (const a of current) currMap.set(keyOf(a), a);

  const regressions: DiffChange[] = [];
  const fixes: DiffChange[] = [];
  const added: DiffAttack[] = [];
  const removed: DiffAttack[] = [];
  let matched = 0;
  let unchanged = 0;

  for (const [k, cur] of currMap) {
    const prev = prevMap.get(k);
    if (!prev) {
      added.push(cur);
      continue;
    }
    matched++;
    const delta = verdictRank(cur.verdict) - verdictRank(prev.verdict);
    if (delta > 0) {
      regressions.push({ category: cur.category, name: cur.name, from: prev.verdict, to: cur.verdict });
    } else if (delta < 0) {
      fixes.push({ category: cur.category, name: cur.name, from: prev.verdict, to: cur.verdict });
    } else {
      unchanged++;
    }
  }
  for (const [k, prev] of prevMap) {
    if (!currMap.has(k)) removed.push(prev);
  }

  const jump = (c: DiffChange) => verdictRank(c.to) - verdictRank(c.from);
  regressions.sort((a, b) => jump(b) - jump(a));
  fixes.sort((a, b) => jump(a) - jump(b)); // biggest improvement (most negative) first

  return { matched, regressions, fixes, unchanged, added, removed };
}

export interface ReportRef {
  filename: string;
  targetUrl?: string;
  timestamp: string;
}

/**
 * The most recent report strictly older than `current` that scanned the SAME
 * target. Returns null when there's no earlier scan for that target.
 */
export function findPreviousReport<T extends ReportRef>(
  reports: T[],
  current: ReportRef,
): T | null {
  const target = (current.targetUrl || "").trim();
  const curTime = new Date(current.timestamp).getTime();
  if (Number.isNaN(curTime)) return null;
  let best: T | null = null;
  let bestTime = -Infinity;
  for (const r of reports) {
    if (r.filename === current.filename) continue;
    if ((r.targetUrl || "").trim() !== target) continue;
    const t = new Date(r.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t < curTime && t > bestTime) {
      best = r;
      bestTime = t;
    }
  }
  return best;
}
