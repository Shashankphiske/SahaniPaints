import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMasterData } from "@/hooks/use-master-data";
import { Search, X, Users, FolderOpen, Hammer, Briefcase, Package, Building2 } from "lucide-react";
import type { Customer, Project, Labour, Contractor, Product } from "@/types/master";

// ─── Types ────────────────────────────────────────────────────────────────────
type Category = "customer" | "site" | "worker" | "contractor" | "material";

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  category: Category;
  route: string;
}

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORY_META: Record<Category, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  customer:   { label: "Customers",   icon: Users,     color: "text-violet-600 dark:text-violet-400",  bg: "bg-violet-50 dark:bg-violet-950/40"  },
  site:       { label: "Sites",       icon: FolderOpen, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40"  },
  worker:     { label: "Workers",     icon: Hammer,    color: "text-amber-600 dark:text-amber-400",    bg: "bg-amber-50 dark:bg-amber-950/40"    },
  contractor: { label: "Contractors", icon: Briefcase, color: "text-rose-600 dark:text-rose-400",      bg: "bg-rose-50 dark:bg-rose-950/40"      },
  material:   { label: "Materials",   icon: Package,   color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50 dark:bg-emerald-950/40"},
};

const CATEGORY_ORDER: Category[] = ["customer", "site", "worker", "contractor", "material"];

// ─── Component ────────────────────────────────────────────────────────────────
export function GlobalSearchBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Data hooks
  const { data: customersRaw }   = useMasterData<Customer>("customers");
  const { data: projectsRaw }    = useMasterData<Project>("projects");
  const { data: laboursRaw }     = useMasterData<Labour>("labours");
  const { data: contractorsRaw } = useMasterData<Contractor>("contractors");
  const { data: productsRaw }    = useMasterData<Product>("products");

  const customers   = useMemo(() => (Array.isArray(customersRaw)   ? customersRaw   : []), [customersRaw]);
  const projects    = useMemo(() => (Array.isArray(projectsRaw)    ? projectsRaw    : []), [projectsRaw]);
  const labours     = useMemo(() => (Array.isArray(laboursRaw)     ? laboursRaw     : []), [laboursRaw]);
  const contractors = useMemo(() => (Array.isArray(contractorsRaw) ? contractorsRaw : []), [contractorsRaw]);
  const products    = useMemo(() => (Array.isArray(productsRaw)    ? productsRaw    : []), [productsRaw]);

  // ── Build unified search index ─────────────────────────────────────────────
  const allResults = useMemo<SearchResult[]>(() => [
    ...customers.map((c) => ({
      id: c.id,
      label: c.name,
      sub: c.phonenumber || c.email || undefined,
      category: "customer" as Category,
      route: `/customers`,
    })),
    ...projects.map((p) => ({
      id: p.id,
      label: p.name,
      sub: p.status || undefined,
      category: "site" as Category,
      route: `/projects`,
    })),
    ...labours.map((l) => ({
      id: l.id,
      label: l.name,
      sub: l.type || l.phonenumber || undefined,
      category: "worker" as Category,
      route: `/masters/labours`,
    })),
    ...contractors.map((c) => ({
      id: c.id,
      label: c.name,
      sub: c.type || c.phonenumber || undefined,
      category: "contractor" as Category,
      route: `/contractor-payments`,
    })),
    ...products.map((p) => ({
      id: p.id,
      label: p.name,
      sub: (p as any).brand?.name || undefined,
      category: "material" as Category,
      route: `/masters/products`,
    })),
  ], [customers, projects, labours, contractors, products]);

  // ── Filtered results ───────────────────────────────────────────────────────
  const filtered = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allResults
      .filter((r) =>
        r.label.toLowerCase().includes(q) ||
        (r.sub && r.sub.toLowerCase().includes(q))
      )
      .slice(0, 40); // cap at 40
  }, [allResults, query]);

  // ── Group results by category ──────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<Category, SearchResult[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of filtered) map.get(r.category)!.push(r);
    return map;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => filtered, [filtered]);

  // ── Reset active index when results change ──────────────────────────────────
  useEffect(() => { setActiveIndex(0); }, [filtered]);

  // ── Global Ctrl+K shortcut ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // ── Focus input when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  // ── Keyboard nav inside list ───────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatList[activeIndex]) {
      selectResult(flatList[activeIndex]);
    }
  }, [flatList, activeIndex]);

  // ── Scroll active item into view ───────────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-active="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectResult = useCallback((r: SearchResult) => {
    navigate(r.route);
    setOpen(false);
  }, [navigate]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Trigger bar ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-muted-foreground hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 transition-all duration-150 group min-w-[220px] max-w-xs w-full shadow-sm"
        title="Search (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-primary transition-colors" />
        <span className="text-xs flex-1 text-left truncate font-medium">Search customers, sites, workers…</span>
        <kbd className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shrink-0">
          Ctrl K
        </kbd>
      </button>

      {/* ── Modal overlay ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh] animate-in fade-in-0 duration-150"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
        >
          <div
            className="w-full max-w-2xl mx-4 bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in slide-in-from-top-2 duration-200 flex flex-col"
            style={{ maxHeight: "75vh" }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-zinc-900">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search customers, sites, workers, contractors, materials…"
                className="flex-1 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground font-medium"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 rounded">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd
                onClick={() => setOpen(false)}
                className="flex items-center bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-400 cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
              >
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto flex-1 py-2">
              {!query.trim() ? (
                /* Empty state — show categories hint */
                <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
                  <div className="grid grid-cols-5 gap-2 mb-1">
                    {CATEGORY_ORDER.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <div key={cat} className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl ${meta.bg}`}>
                          <meta.icon className={`h-4 w-4 ${meta.color}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Start typing to search across all entities</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Building2 className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No results for "{query}"</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try a different name or keyword</p>
                </div>
              ) : (
                /* Grouped results */
                CATEGORY_ORDER.map((cat) => {
                  const items = grouped.get(cat)!;
                  if (items.length === 0) return null;
                  const meta = CATEGORY_META[cat];

                  return (
                    <div key={cat} className="mb-1">
                      {/* Category header */}
                      <div className={`flex items-center gap-2 px-4 py-1.5 sticky top-0 bg-white dark:bg-zinc-950 z-10`}>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${meta.bg}`}>
                          <meta.icon className={`h-3 w-3 ${meta.color}`} />
                          <span className={`text-[10px] font-extrabold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{items.length} result{items.length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Items */}
                      {items.map((r) => {
                        const globalIdx = flatList.indexOf(r);
                        const isActive = globalIdx === activeIndex;
                        return (
                          <div
                            key={r.id}
                            data-active={isActive}
                            onMouseEnter={() => setActiveIndex(globalIdx)}
                            onClick={() => selectResult(r)}
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-75 ${
                              isActive
                                ? "bg-primary/5 dark:bg-primary/10"
                                : "hover:bg-slate-50 dark:hover:bg-zinc-900"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                              <meta.icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                <Highlight text={r.label} query={query} />
                              </p>
                              {r.sub && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  <Highlight text={r.sub} query={query} />
                                </p>
                              )}
                            </div>
                            {isActive && (
                              <span className="text-[10px] text-muted-foreground shrink-0 border border-slate-200 dark:border-zinc-700 rounded px-1.5 py-0.5 font-mono">↵</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="border-t border-slate-100 dark:border-zinc-900 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><kbd className="border border-slate-200 dark:border-zinc-700 rounded px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="border border-slate-200 dark:border-zinc-700 rounded px-1 py-0.5 font-mono">↵</kbd> open</span>
                <span className="flex items-center gap-1"><kbd className="border border-slate-200 dark:border-zinc-700 rounded px-1 py-0.5 font-mono">Esc</kbd> close</span>
                <span className="ml-auto font-medium">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Highlight matching text ───────────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/15 text-primary dark:bg-primary/25 rounded-sm px-0.5 font-extrabold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
