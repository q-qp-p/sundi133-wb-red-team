import { describe, it, expect } from "vitest";
import {
  statusOf,
  buildDeveloperReport,
  type ExportInput,
} from "../dashboard/ui/src/lib/report-export";

describe("statusOf", () => {
  it("maps verdicts to statuses (PASS = vulnerable)", () => {
    expect(statusOf("PASS")).toBe("vulnerable");
    expect(statusOf("PARTIAL")).toBe("partial");
    expect(statusOf("FAIL")).toBe("defended");
    expect(statusOf("ERROR")).toBe("error");
    expect(statusOf("pass")).toBe("vulnerable");
  });
});

const input: ExportInput = {
  target: "https://app.example.com",
  timestamp: "2026-09-27T10:00:00Z",
  score: 62,
  findings: [
    { attack: "Defended low", category: "misc", severity: "low", verdict: "FAIL" },
    { attack: "Critical leak", category: "pii_disclosure", severity: "critical", verdict: "PASS", controls: [{ framework: "GDPR", code: "ART-32", title: "Security" }], evidence: "leaked SSN" },
    { attack: "High inject", category: "prompt_injection", severity: "high", verdict: "PASS" },
    { attack: "Partial thing", category: "misc", severity: "medium", verdict: "PARTIAL" },
  ],
};

describe("buildDeveloperReport", () => {
  const rep = buildDeveloperReport(input);

  it("carries schema, target, score and a correct summary", () => {
    expect(rep.schema).toBe("wb-red-team.dev-report/v1");
    expect(rep.target).toBe("https://app.example.com");
    expect(rep.score).toBe(62);
    expect(rep.summary).toEqual({ total: 4, vulnerable: 2, partial: 1, defended: 1 });
  });

  it("sorts vulnerable first, then by severity, defended last", () => {
    expect(rep.findings.map((f) => f.attack)).toEqual([
      "Critical leak", // vulnerable + critical
      "High inject", // vulnerable + high
      "Partial thing", // partial
      "Defended low", // defended
    ]);
  });

  it("derives status and keeps compliance + evidence", () => {
    const leak = rep.findings[0];
    expect(leak.status).toBe("vulnerable");
    expect(leak.compliance).toHaveLength(1);
    expect(leak.compliance[0].code).toBe("ART-32");
    expect(leak.evidence).toBe("leaked SSN");
  });

  it("generates stable, slugged ids from category + attack", () => {
    expect(rep.findings[0].id).toBe("pii-disclosure--critical-leak");
  });

  it("defaults missing compliance/evidence to []/empty", () => {
    const inj = rep.findings.find((f) => f.attack === "High inject")!;
    expect(inj.compliance).toEqual([]);
    expect(inj.evidence).toBe("");
  });
});
