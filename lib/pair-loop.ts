import { executeAttack } from "./attack-runner.js";
import { analyzeResponse, type AppContext } from "./response-analyzer.js";
import {
  reviseAttackAdaptive,
  type AdaptiveConversation,
} from "./attack-planner.js";
import type {
  Config,
  Attack,
  AttackResult,
  AttackCategory,
  CategoryDefenseProfile,
} from "./types.js";

/**
 * Phase 2 — adaptive PAIR inner loop, shared by the CLI (red-team.ts) and the
 * in-process runner (run.ts) so the behaviour is identical on both paths.
 *
 * For each non-PASS seed (capped per category), keep a single ATTACKER
 * CONVERSATION and iterate: show the attacker the target's actual reply + the
 * judge verdict + the observed defense, get ONE revised attack, execute + judge,
 * and repeat until PASS or the per-seed query budget is spent. Results are
 * pushed onto `roundResults`. Scope: defensive benchmark — the objective is to
 * make the target cross far enough for the judge to SCORE it, never to produce a
 * usable real-world artifact.
 */
export async function runPairLoopOverSeeds(args: {
  config: Config;
  round: number;
  roundResults: AttackResult[];
  appContext?: AppContext;
  defenseProfiles?: Map<AttackCategory, CategoryDefenseProfile>;
  onLog?: (message: string) => void;
  checkAbort?: () => void;
}): Promise<void> {
  const { config, round, roundResults, appContext, defenseProfiles } = args;
  const log = args.onLog ?? (() => {});
  const checkAbort = args.checkAbort ?? (() => {});

  if (
    !config.attackConfig.enablePairLoop ||
    !config.attackConfig.enableLlmGeneration
  ) {
    return;
  }

  const budget = Math.max(
    2,
    config.attackConfig.maxAdaptiveQueriesPerSeed ?? 8,
  );
  const capPerCat = config.attackConfig.pairLoopMaxSeedsPerCategory ?? 4;

  const seenPerCat = new Map<AttackCategory, number>();
  const seeds: AttackResult[] = [];
  for (const r of roundResults) {
    if (r.verdict === "PASS" || r.verdict === "ERROR") continue;
    const n = seenPerCat.get(r.attack.category) ?? 0;
    if (n >= capPerCat) continue;
    seenPerCat.set(r.attack.category, n + 1);
    seeds.push(r);
  }
  if (seeds.length === 0) return;

  log(
    `Adaptive PAIR loop on ${seeds.length} seed(s), budget ${budget} queries/seed...`,
  );

  const toText = (b: unknown): string =>
    typeof b === "string"
      ? b
      : (() => {
          try {
            return JSON.stringify(b);
          } catch {
            return String(b);
          }
        })();

  const runForSeed = async (seed: AttackResult): Promise<void> => {
    let conversation: AdaptiveConversation = { messages: [] };
    let priorAttack = seed.attack;
    let last = seed; // the seed's own first execution counts as query 1
    for (let q = 2; q <= budget; q++) {
      checkAbort();
      if (last.verdict === "PASS") return;

      const profile = defenseProfiles?.get(seed.attack.category);
      const defenseSummary = profile
        ? `dominant=${profile.dominantDefense}, blockRate=${Math.round(
            profile.blockRate * 100,
          )}%, refusalPatterns=${(profile.refusalPatterns ?? [])
            .slice(0, 4)
            .join("; ")}`
        : undefined;
      const priorMessage = toText(
        (priorAttack.payload as Record<string, unknown> | undefined)?.message ??
          priorAttack.payload,
      );

      const revised = await reviseAttackAdaptive({
        config,
        category: seed.attack.category,
        seedName: seed.attack.name,
        priorAttackMessage: priorMessage.slice(0, 1600),
        targetResponse: toText(last.responseBody),
        verdict: last.verdict,
        judgeReasoning: last.llmReasoning,
        defenseSummary,
        conversation,
        iteration: q - 1,
      });
      conversation = revised.conversation;

      const revisedMessage = (
        revised.attack?.payload as Record<string, unknown> | undefined
      )?.message;
      if (!revised.attack || !revisedMessage) return;

      const nextAttack: Attack = {
        ...revised.attack,
        category: seed.attack.category,
        isLlmGenerated: true,
        refinedFrom: seed.attack.id,
        id:
          revised.attack.id ||
          `pair-${seed.attack.category}-r${round}-q${q}-${seed.attack.id}`,
      };

      const { statusCode, body, timeMs, executionTrace } = await executeAttack(
        config,
        nextAttack,
      );
      checkAbort();
      const result = await analyzeResponse(
        config,
        nextAttack,
        statusCode,
        body,
        timeMs,
        appContext,
        executionTrace,
      );
      roundResults.push(result);
      log(
        `[PAIR q${q}/${budget}] ${nextAttack.category} ← ${seed.attack.name} → ${result.verdict}`,
      );

      priorAttack = nextAttack;
      last = result;
      if (result.verdict === "PASS") return;
    }
  };

  const parallelism = Math.max(
    1,
    config.attackConfig.categoryParallelism ?? 1,
  );
  const cursor = { value: 0 };
  const worker = async (): Promise<void> => {
    while (true) {
      checkAbort();
      const i = cursor.value++;
      if (i >= seeds.length) break;
      await runForSeed(seeds[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(parallelism, seeds.length) }, () => worker()),
  );
}
