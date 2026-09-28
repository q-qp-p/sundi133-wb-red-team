import type { FullReport, ReportResult } from "@/api/types";
import type { DiffAttack } from "./report-diff";

/** Display name for a result's attack (handles object | string | flat field). */
export function getAttackName(result: ReportResult): string {
  const atk = result.attack;
  if (typeof atk === "object" && atk !== null)
    return ((atk as Record<string, unknown>).name as string) ?? "Unknown";
  if (typeof atk === "string") return atk;
  return result.attackName ?? "Unknown";
}

/** Category for a result, falling back to the nested attack object. */
export function getCategory(result: ReportResult): string {
  if (result.category) return result.category;
  const atk = result.attack;
  if (typeof atk === "object" && atk !== null)
    return ((atk as Record<string, unknown>).category as string) ?? "";
  return "";
}

/** Flatten a report's attacks across all rounds into the diff shape. */
export function reportToAttacks(rep: FullReport): DiffAttack[] {
  return (rep.rounds ?? [])
    .flatMap((r) => r.results ?? [])
    .map((res) => ({
      category: getCategory(res),
      name: getAttackName(res),
      verdict: res.verdict,
    }));
}
