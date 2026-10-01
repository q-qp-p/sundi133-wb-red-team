import { describe, expect, it } from "vitest";
import type { Attack, Config } from "../lib/types.js";
import {
  estimatePreRun,
  estimateRun,
  formatEstimate,
} from "../lib/run-estimator.js";

// The estimator only reads attackConfig; everything else is irrelevant here.
function cfg(attackConfig: Partial<Config["attackConfig"]>): Config {
  return {
    attackConfig: {
      adaptiveRounds: 1,
      maxAttacksPerCategory: 12,
      strategiesPerRound: 8,
      attacksPerStrategy: 1,
      enableLlmGeneration: true,
      enableMultiTurnGeneration: false,
      enableAdaptiveMultiTurn: false,
      ...attackConfig,
    },
  } as unknown as Config;
}

function attack(id: string, category: string): Attack {
  return {
    id,
    category,
    name: id,
    payload: { message: "x" },
    isLlmGenerated: false,
  } as unknown as Attack;
}

describe("run-estimator — adaptive PAIR loop share", () => {
  it("adds nothing when the loop is off (keys absent or false)", () => {
    const absent = estimatePreRun(cfg({}), 8, 170);
    const off = estimatePreRun(cfg({ enablePairLoop: false }), 8, 170);
    expect(absent.pair).toBeUndefined();
    expect(off).toEqual(absent);
  });

  it("is gated on enableLlmGeneration exactly like lib/pair-loop.ts", () => {
    const est = estimatePreRun(
      cfg({ enablePairLoop: true, enableLlmGeneration: false }),
      8,
      170,
    );
    expect(est.pair).toBeUndefined();
  });

  it("pre-run: seeds = categories × per-category cap; iterations = seeds × min(budget-1, 4)", () => {
    const off = estimatePreRun(cfg({}), 8, 170);
    const on = estimatePreRun(
      cfg({
        enablePairLoop: true,
        maxAdaptiveQueriesPerSeed: 8,
        pairLoopMaxSeedsPerCategory: 3,
      }),
      8,
      170,
    );
    // perCategoryRound1 (3 seeds + 8 generated = 11) exceeds the cap of 3.
    expect(on.pair).toEqual({ seeds: 24, itersExpected: 96, itersMax: 168 });
    expect(on.httpCalls.expected - off.httpCalls.expected).toBe(96);
    expect(on.httpCalls.max - off.httpCalls.max).toBe(168);
    expect(on.httpCalls.min - off.httpCalls.min).toBe(24);
    expect(on.totalAttacksExpected - off.totalAttacksExpected).toBe(96);
    expect(on.wallTimeSec.expected).toBeGreaterThan(off.wallTimeSec.expected);
    // plannedAttacks is first-pass only; PAIR attacks are extra.
    expect(on.plannedAttacks).toBe(off.plannedAttacks);
  });

  it("a small budget caps expected iterations at budget-1", () => {
    const est = estimatePreRun(
      cfg({
        enablePairLoop: true,
        maxAdaptiveQueriesPerSeed: 3,
        pairLoopMaxSeedsPerCategory: 1,
      }),
      2,
      170,
    );
    expect(est.pair).toEqual({ seeds: 2, itersExpected: 4, itersMax: 4 });
  });

  it("post-planning: seeds = Σ min(cap, attacks in category)", () => {
    const attacks = [
      attack("a1", "cyber_crime"),
      attack("a2", "cyber_crime"),
      attack("a3", "cyber_crime"),
      attack("a4", "cyber_crime"),
      attack("a5", "cyber_crime"),
      attack("b1", "financial_crime"),
    ];
    const est = estimateRun(
      attacks,
      cfg({
        enablePairLoop: true,
        maxAdaptiveQueriesPerSeed: 8,
        pairLoopMaxSeedsPerCategory: 3,
      }),
    );
    expect(est.pair).toEqual({ seeds: 4, itersExpected: 16, itersMax: 28 });
    expect(est.plannedAttacks).toBe(6);
    expect(est.totalAttacksExpected).toBe(6 + est.refinedExpected + 16);
  });

  it("formatEstimate prints a PAIR line only when the loop contributes", () => {
    const off = formatEstimate(estimatePreRun(cfg({}), 8, 170), 2);
    const on = formatEstimate(
      estimatePreRun(cfg({ enablePairLoop: true }), 8, 170),
      2,
    );
    expect(off.some((l) => l.includes("PAIR loop"))).toBe(false);
    const line = on.find((l) => l.includes("PAIR loop"));
    expect(line).toBeDefined();
    expect(line).toMatch(/32 refused seeds retried/);
    expect(line).toMatch(/~128 extra attacks \(max 224\)/);
  });
});
