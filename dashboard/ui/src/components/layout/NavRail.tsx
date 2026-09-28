import { useLocation, useNavigate } from "react-router";
import { useUIStore } from "@/stores/uiStore";
import {
  LayoutDashboard,
  Play,
  PlusCircle,
  FileText,
  AlertTriangle,
  CheckSquare,
  Shield,
  Briefcase,
  Database,
  Gauge,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type NavItem = { path: string; label: string; icon: React.ElementType };
type NavSection = { label?: string; items: NavItem[] };

// Grouped like a modern admin console — a short unlabeled top group, then
// labeled sections. Same routes/labels/icons as before, only reorganized.
const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ path: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Testing",
    items: [
      { path: "/new-scan", label: "Launch Scan", icon: PlusCircle },
      { path: "/scans", label: "Scan Activity", icon: Play },
      { path: "/datasets", label: "Datasets", icon: Database },
      { path: "/evaluations", label: "Evaluations", icon: Gauge },
    ],
  },
  {
    label: "Insights",
    items: [
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/risk", label: "Risk", icon: AlertTriangle },
      { path: "/compliance", label: "Compliance", icon: CheckSquare },
    ],
  },
  {
    label: "Governance",
    items: [
      { path: "/policies", label: "Policies", icon: Briefcase },
      { path: "/activity-log", label: "Activity Log", icon: Shield },
    ],
  },
];

export function NavRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { navCollapsed, toggleNav } = useUIStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const go = (path: string) => {
    navigate(path);
    if (window.innerWidth < 1100) useUIStore.getState().setNavCollapsed(true);
  };

  return (
    <aside
      className={`flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ${
        navCollapsed ? "w-16" : "w-[224px]"
      }`}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 h-14 px-4 border-b border-sidebar-border cursor-pointer shrink-0 overflow-hidden"
        onClick={() => navigate("/dashboard")}
      >
        <div className="w-8 h-8 shrink-0 rounded-lg bg-primary flex items-center justify-center shadow-sm">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!navCollapsed && (
          <div className="min-w-0">
            <span className="text-sm font-semibold text-foreground tracking-tight block leading-tight">
              Red Team
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              AI Security
            </span>
          </div>
        )}
      </div>

      {/* Nav sections */}
      <nav
        className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${
          navCollapsed ? "px-2" : "px-2.5"
        }`}
      >
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? "mt-5" : ""}>
            {section.label &&
              (navCollapsed ? (
                <div className="mx-2 my-2 h-px bg-sidebar-border" />
              ) : (
                <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/60">
                  {section.label}
                </div>
              ))}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ path, label, icon: Icon }) => {
                const active = isActive(path);
                return (
                  <button
                    key={path}
                    onClick={() => go(path)}
                    title={navCollapsed ? label : undefined}
                    className={`flex items-center gap-2.5 w-full rounded-lg transition-colors relative group
                      ${navCollapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"}
                      ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    <Icon
                      className={`w-[17px] h-[17px] shrink-0 ${active ? "text-sidebar-accent-foreground" : ""}`}
                    />
                    {!navCollapsed && (
                      <span className="text-[13px] flex-1 text-left truncate">
                        {label}
                      </span>
                    )}
                    {navCollapsed && (
                      <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-foreground text-background text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 z-50 shadow-lg">
                        {label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2.5">
        <button
          onClick={toggleNav}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {navCollapsed ? (
            <ChevronsRight className="w-4 h-4 mx-auto" />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4" />
              <span className="text-[12px]">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
