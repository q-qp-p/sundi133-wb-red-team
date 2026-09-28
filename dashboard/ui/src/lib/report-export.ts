/**
 * Pure builders for audience-specific report exports — no React, no imports,
 * so they unit-test cleanly. The UI maps its report into these plain shapes.
 */

export interface ExportControl {
  framework: string;
  code: string;
  title: string;
}

export interface ExportFinding {
  attack: string;
  category: string;
  severity: string;
  /** Raw verdict: PASS = vulnerable, PARTIAL = partial, FAIL = defended. */
  verdict: string;
  controls?: ExportControl[];
  evidence?: string;
}

export interface ExportInput {
  target: string;
  timestamp: string;
  score: number;
  findings: ExportFinding[];
}

export type FindingStatus = "vulnerable" | "partial" | "defended" | "error";

export function statusOf(verdict: string): FindingStatus {
  switch ((verdict || "").toUpperCase()) {
    case "PASS":
      return "vulnerable";
    case "PARTIAL":
      return "partial";
    case "FAIL":
      return "defended";
    default:
      return "error";
  }
}

function severityRank(s: string): number {
  switch ((s || "").toLowerCase()) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 0;
  }
}

const STATUS_ORDER: Record<FindingStatus, number> = {
  vulnerable: 0,
  partial: 1,
  error: 2,
  defended: 3,
};

/** A slug for a finding id, stable across runs for the same attack. */
function slug(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface DeveloperReport {
  schema: "wb-red-team.dev-report/v1";
  target: string;
  timestamp: string;
  score: number;
  summary: {
    total: number;
    vulnerable: number;
    partial: number;
    defended: number;
  };
  findings: Array<{
    id: string;
    attack: string;
    category: string;
    severity: string;
    status: FindingStatus;
    compliance: ExportControl[];
    evidence: string;
  }>;
}

/**
 * A machine-readable developer report: every finding with its status, mapped
 * compliance controls, and evidence — actionable ones (vulnerable/partial)
 * sorted first, then by severity.
 */
export function buildDeveloperReport(input: ExportInput): DeveloperReport {
  const findings = input.findings
    .map((f) => ({
      id: `${slug(f.category)}--${slug(f.attack)}`,
      attack: f.attack,
      category: f.category,
      severity: f.severity,
      status: statusOf(f.verdict),
      compliance: f.controls ?? [],
      evidence: f.evidence ?? "",
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        severityRank(b.severity) - severityRank(a.severity),
    );

  return {
    schema: "wb-red-team.dev-report/v1",
    target: input.target,
    timestamp: input.timestamp,
    score: input.score,
    summary: {
      total: findings.length,
      vulnerable: findings.filter((f) => f.status === "vulnerable").length,
      partial: findings.filter((f) => f.status === "partial").length,
      defended: findings.filter((f) => f.status === "defended").length,
    },
    findings,
  };
}
