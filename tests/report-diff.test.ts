import { describe, it, expect } from "vitest";
import {
  verdictRank,
  diffReports,
  findPreviousReport,
  type DiffAttack,
} from "../dashboard/ui/src/lib/report-diff";

const A = (category: string, name: string, verdict: string): DiffAttack => ({
  category,
  name,
  verdict,
});

describe("verdictRank", () => {
  it("ranks PASS (vulnerable) worst, FAIL (defended) best", () => {
    expect(verdictRank("PASS")).toBe(2);
    expect(verdictRank("PARTIAL")).toBe(1);
    expect(verdictRank("FAIL")).toBe(0);
    expect(verdictRank("ERROR")).toBe(0);
    expect(verdictRank("")).toBe(0);
  });
  it("is case-insensitive", () => {
    expect(verdictRank("pass")).toBe(2);
  });
});

describe("diffReports", () => {
  it("flags a defended → vulnerable transition as a regression", () => {
    const prev = [A("prompt_injection", "override", "FAIL")];
    const curr = [A("prompt_injection", "override", "PASS")];
    const d = diffReports(prev, curr);
    expect(d.regressions).toHaveLength(1);
    expect(d.fixes).toHaveLength(0);
    expect(d.regressions[0]).toMatchObject({ from: "FAIL", to: "PASS" });
    expect(d.matched).toBe(1);
  });

  it("flags a vulnerable → defended transition as a fix", () => {
    const prev = [A("pii", "leak", "PASS")];
    const curr = [A("pii", "leak", "FAIL")];
    const d = diffReports(prev, curr);
    expect(d.fixes).toHaveLength(1);
    expect(d.regressions).toHaveLength(0);
  });

  it("PARTIAL → PASS is a regression; PASS → PARTIAL is a fix", () => {
    expect(
      diffReports([A("c", "x", "PARTIAL")], [A("c", "x", "PASS")]).regressions,
    ).toHaveLength(1);
    expect(
      diffReports([A("c", "x", "PASS")], [A("c", "x", "PARTIAL")]).fixes,
    ).toHaveLength(1);
  });

  it("counts identical verdicts as unchanged, not a change", () => {
    const same = [A("c", "x", "PASS")];
    const d = diffReports(same, [A("c", "x", "PASS")]);
    expect(d.unchanged).toBe(1);
    expect(d.regressions).toHaveLength(0);
    expect(d.fixes).toHaveLength(0);
  });

  it("classifies attacks only in current as added, only in previous as removed", () => {
    const prev = [A("c", "old", "FAIL")];
    const curr = [A("c", "new", "PASS")];
    const d = diffReports(prev, curr);
    expect(d.added.map((a) => a.name)).toEqual(["new"]);
    expect(d.removed.map((a) => a.name)).toEqual(["old"]);
    expect(d.matched).toBe(0);
  });

  it("aligns on category + name case-insensitively / trimmed", () => {
    const prev = [A("Prompt_Injection", " Override ", "FAIL")];
    const curr = [A("prompt_injection", "override", "PASS")];
    const d = diffReports(prev, curr);
    expect(d.matched).toBe(1);
    expect(d.regressions).toHaveLength(1);
  });

  it("sorts regressions worst-jump first", () => {
    const prev = [A("c", "a", "PARTIAL"), A("c", "b", "FAIL")];
    const curr = [A("c", "a", "PASS"), A("c", "b", "PASS")];
    const d = diffReports(prev, curr);
    // b jumped FAIL(0)→PASS(2) = +2, a jumped PARTIAL(1)→PASS(2) = +1
    expect(d.regressions[0].name).toBe("b");
    expect(d.regressions[1].name).toBe("a");
  });

  it("handles empty inputs", () => {
    const d = diffReports([], []);
    expect(d).toMatchObject({ matched: 0, unchanged: 0 });
    expect(d.regressions).toHaveLength(0);
    expect(d.added).toHaveLength(0);
  });
});

describe("findPreviousReport", () => {
  const reports = [
    { filename: "c.json", targetUrl: "https://app.example.com", timestamp: "2026-03-03T00:00:00Z" },
    { filename: "b.json", targetUrl: "https://app.example.com", timestamp: "2026-02-02T00:00:00Z" },
    { filename: "a.json", targetUrl: "https://app.example.com", timestamp: "2026-01-01T00:00:00Z" },
    { filename: "other.json", targetUrl: "https://other.example.com", timestamp: "2026-02-15T00:00:00Z" },
  ];

  it("returns the most recent earlier report for the same target", () => {
    const prev = findPreviousReport(reports, reports[0]); // c.json
    expect(prev?.filename).toBe("b.json");
  });

  it("ignores reports for a different target", () => {
    const prev = findPreviousReport(reports, reports[1]); // b.json
    expect(prev?.filename).toBe("a.json"); // not other.json (different target)
  });

  it("returns null when there's no earlier scan for the target", () => {
    expect(findPreviousReport(reports, reports[2])).toBeNull(); // a.json is oldest
  });

  it("never returns the current report itself", () => {
    const prev = findPreviousReport(reports, reports[0]);
    expect(prev?.filename).not.toBe("c.json");
  });

  it("returns null for an unknown/blank target", () => {
    expect(
      findPreviousReport(reports, { filename: "x.json", targetUrl: "https://nope.com", timestamp: "2026-05-05T00:00:00Z" }),
    ).toBeNull();
  });
});
