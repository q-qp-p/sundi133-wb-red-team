import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { getReportsMeta, getReport } from "@/api/reports";
import type { ReportMeta, FullReport } from "@/api/types";
import {
  diffReports,
  verdictRank,
  type ReportDiff,
  type DiffChange,
} from "@/lib/report-diff";
import { reportToAttacks } from "@/lib/report-attacks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ArrowLeft,
  ArrowRight,
  GitCompareArrows,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

function pretty(s: string): string {
  return (s || "").replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Small verdict pill: PASS=vulnerable(red), PARTIAL=at-risk(amber), else defended(green). */
function VerdictPill({ v }: { v: string }) {
  const up = (v || "").toUpperCase();
  const cls =
    up === "PASS"
      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
      : up === "PARTIAL"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  const label = up === "PASS" ? "Vulnerable" : up === "PARTIAL" ? "At risk" : "Defended";
  return (
    <span className={`inline-flex items-center text-[10.5px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

function ChangeRow({ c }: { c: DiffChange }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
        {pretty(c.category)}
      </span>
      <span className="text-foreground/90 truncate flex-1 min-w-0" title={c.name}>
        {c.name}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <VerdictPill v={c.from} />
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <VerdictPill v={c.to} />
      </span>
    </div>
  );
}

/** Per-category rollup of regressions/fixes. */
function categoryRollup(diff: ReportDiff) {
  const map = new Map<string, { regressed: number; fixed: number }>();
  for (const r of diff.regressions) {
    const e = map.get(r.category) ?? { regressed: 0, fixed: 0 };
    e.regressed++;
    map.set(r.category, e);
  }
  for (const f of diff.fixes) {
    const e = map.get(f.category) ?? { regressed: 0, fixed: 0 };
    e.fixed++;
    map.set(f.category, e);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v, net: v.regressed - v.fixed }))
    .sort((a, b) => b.net - a.net || b.regressed - a.regressed);
}

export default function ScanComparePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const [aFile, setAFile] = useState(params.get("a") ?? "");
  const [bFile, setBFile] = useState(params.get("b") ?? "");
  const [aReport, setAReport] = useState<FullReport | null>(null);
  const [bReport, setBReport] = useState<FullReport | null>(null);
  const [pairLoading, setPairLoading] = useState(false);

  // Load the report list; default to the two most recent scans.
  useEffect(() => {
    getReportsMeta(1, 200)
      .then((res) => {
        setReports(res.items);
        setAFile((cur) => cur || res.items[1]?.filename || "");
        setBFile((cur) => cur || res.items[0]?.filename || "");
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  // Keep the URL shareable.
  useEffect(() => {
    if (!aFile && !bFile) return;
    const next = new URLSearchParams();
    if (aFile) next.set("a", aFile);
    if (bFile) next.set("b", bFile);
    setParams(next, { replace: true });
  }, [aFile, bFile, setParams]);

  // Fetch the selected pair.
  useEffect(() => {
    if (!aFile || !bFile) return;
    let cancelled = false;
    setPairLoading(true);
    Promise.all([getReport(aFile, false), getReport(bFile, false)])
      .then(([a, b]) => {
        if (cancelled) return;
        setAReport(a);
        setBReport(b);
      })
      .catch(() => {
        if (!cancelled) {
          setAReport(null);
          setBReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPairLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aFile, bFile]);

  const aMeta = reports.find((r) => r.filename === aFile);
  const bMeta = reports.find((r) => r.filename === bFile);
  const diff: ReportDiff | null = useMemo(
    () =>
      aReport && bReport
        ? diffReports(reportToAttacks(aReport), reportToAttacks(bReport))
        : null,
    [aReport, bReport],
  );
  const rollup = useMemo(() => (diff ? categoryRollup(diff) : []), [diff]);

  const scoreDelta =
    aMeta && bMeta ? bMeta.score - aMeta.score : 0;
  const DeltaIcon = scoreDelta > 0 ? TrendingUp : scoreDelta < 0 ? TrendingDown : Minus;
  const deltaTone =
    scoreDelta > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : scoreDelta < 0
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const sameTarget =
    !aMeta || !bMeta || (aMeta.targetUrl || "") === (bMeta.targetUrl || "");

  const Picker = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <div className="flex-1 min-w-0">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      >
        <option value="">Select a scan…</option>
        {reports.map((r) => (
          <option key={r.filename} value={r.filename}>
            {(r.targetUrl || r.filename)} — {fmtDate(r.timestamp)} ({r.score})
          </option>
        ))}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <button
        onClick={() => navigate("/reports")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to Reports
      </button>

      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <GitCompareArrows className="w-5 h-5 text-primary" />
          Compare scans
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Diff two scans to see what regressed, what was fixed, and what changed.
        </p>
      </div>

      {reports.length < 2 ? (
        <EmptyState
          title="Need at least two reports to compare"
          description="Run more scans to compare results over time."
          icon={<GitCompareArrows size={48} />}
        />
      ) : (
        <>
          {/* Pickers */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-end gap-3 flex-wrap">
                <Picker label="Baseline (A)" value={aFile} onChange={setAFile} />
                <ArrowRight className="w-4 h-4 text-muted-foreground mb-3 shrink-0" />
                <Picker label="Compared (B)" value={bFile} onChange={setBFile} />
              </div>
              {!sameTarget && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                  These scans target different endpoints — attacks may not align, so
                  most rows will show as added/removed rather than changed.
                </p>
              )}
            </CardContent>
          </Card>

          {pairLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {!pairLoading && diff && aMeta && bMeta && (
            <>
              {/* Summary */}
              <Card>
                <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {aMeta.score}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {bMeta.score}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-sm font-semibold ml-1 ${deltaTone}`}>
                      <DeltaIcon className="w-4 h-4" />
                      {scoreDelta > 0 ? "+" : ""}
                      {scoreDelta}
                    </span>
                    <span className="text-xs text-muted-foreground">score</span>
                  </div>
                  <div className="h-6 w-px bg-border hidden sm:block" />
                  {([
                    ["regressed", diff.regressions.length, "text-red-600 dark:text-red-400"],
                    ["fixed", diff.fixes.length, "text-emerald-600 dark:text-emerald-400"],
                    ["unchanged", diff.unchanged, "text-foreground"],
                    ["new", diff.added.length, "text-foreground"],
                    ["removed", diff.removed.length, "text-foreground"],
                  ] as const).map(([label, n, tone]) => (
                    <span key={label} className="inline-flex items-center gap-1.5 text-sm">
                      <span className={`font-semibold tabular-nums ${tone}`}>{n}</span>
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  ))}
                </CardContent>
              </Card>

              {/* Regressions + Fixes */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                      Regressions
                      <span className="text-xs font-normal text-muted-foreground">
                        {diff.regressions.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 divide-y divide-border max-h-96 overflow-y-auto">
                    {diff.regressions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No regressions — nothing got worse. 🎉
                      </p>
                    ) : (
                      diff.regressions.map((c, i) => <ChangeRow key={i} c={c} />)
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Fixes
                      <span className="text-xs font-normal text-muted-foreground">
                        {diff.fixes.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 divide-y divide-border max-h-96 overflow-y-auto">
                    {diff.fixes.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No fixes in this window.
                      </p>
                    ) : (
                      diff.fixes.map((c, i) => <ChangeRow key={i} c={c} />)
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Per-category rollup */}
              {rollup.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">By category</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border">
                      {rollup.map((row) => (
                        <div
                          key={row.category}
                          className="flex items-center gap-3 py-2 text-sm"
                        >
                          <span className="flex-1 min-w-0 truncate text-foreground/90">
                            {pretty(row.category)}
                          </span>
                          {row.regressed > 0 && (
                            <span className="text-red-600 dark:text-red-400 tabular-nums">
                              +{row.regressed} regressed
                            </span>
                          )}
                          {row.fixed > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                              −{row.fixed} fixed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Added / removed coverage */}
              {(diff.added.length > 0 || diff.removed.length > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Coverage changes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        New in B ({diff.added.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {diff.added.slice(0, 40).map((a, i) => (
                          <span
                            key={i}
                            title={a.name}
                            className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground max-w-[14rem] truncate"
                          >
                            {a.name}
                          </span>
                        ))}
                        {diff.added.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        Dropped from A ({diff.removed.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {diff.removed.slice(0, 40).map((a, i) => (
                          <span
                            key={i}
                            title={a.name}
                            className="inline-flex items-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground max-w-[14rem] truncate"
                          >
                            {a.name}
                          </span>
                        ))}
                        {diff.removed.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
