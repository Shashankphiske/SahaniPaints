import { useState, useEffect, useMemo, useCallback } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Loader2,
  Trash2,
  CheckCircle2,
  Copy,
  CalendarDays,
  Users,
  Briefcase,
  ChevronRight,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Labour, Contractor, LabourPayment, ContractorPayment } from "@/types/master";
import { supabase } from "@/lib/realtime";

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMostRecentTuesday(fromDate?: Date): string {
  const d = fromDate ? new Date(fromDate) : new Date();
  const day = d.getDay();
  const diff = day >= 2 ? day - 2 : day + 5;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0];
}

function getPreviousTuesday(tuesdayStr: string): string {
  const d = new Date(tuesdayStr);
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" });
}

const formatPrice = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const typeBadge = (type: "WEEKLY" | "MONTHLY") => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
      type === "MONTHLY"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40"
    }`}
  >
    {type === "MONTHLY" ? "Monthly" : "Weekly"}
  </span>
);

// ─── Row types ───────────────────────────────────────────────────────────────

interface LabourRow {
  labourId: string;
  name: string;
  paymentPerDay: number;
  type: "WEEKLY" | "MONTHLY";
  phonenumber: string | null;
  amount: string;
}

interface ContractorRow {
  contractorId: string;
  name: string;
  type: "WEEKLY" | "MONTHLY";
  phonenumber?: string | null;
  amount: string;
}

// ─── Diary record types (for history view) ──────────────────────────────────

interface DiaryEntry {
  date: string; // YYYY-MM-DD
  labourPayments: any[];      // raw records — names resolved at render time
  contractorPayments: any[];  // raw records — names resolved at render time
  totalLabour: number;
  totalContractor: number;
  grandTotal: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WeeklyDiaryPage() {
  const { toast } = useToast();

  const { data: laboursRaw } = useMasterData<Labour>("labours");
  const { data: contractorsRaw } = useMasterData<Contractor>("contractors");

  const allLabours = useMemo(
    () => (Array.isArray(laboursRaw) ? laboursRaw : []),
    [laboursRaw]
  );
  const allContractors = useMemo(
    () => (Array.isArray(contractorsRaw) ? contractorsRaw : []),
    [contractorsRaw]
  );

  const [selectedDate, setSelectedDate] = useState<string>(getMostRecentTuesday);

  const [labourRows, setLabourRows] = useState<LabourRow[]>([]);
  const [contractorRows, setContractorRows] = useState<ContractorRow[]>([]);

  const [copying, setCopying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [showOnlyWeekly, setShowOnlyWeekly] = useState(true);

  // ── History / saved records ──────────────────────────────────────────────
  const [diaryHistory, setDiaryHistory] = useState<DiaryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // ── Populate entry rows from master lists ────────────────────────────────
  useEffect(() => {
    setSubmitted(false);

    const filteredLabours = showOnlyWeekly
      ? allLabours.filter((l) => l.type === "WEEKLY")
      : allLabours;
    const filteredContractors = showOnlyWeekly
      ? allContractors.filter((c) => c.type === "WEEKLY")
      : allContractors;

    setLabourRows(
      filteredLabours.map((l) => ({
        labourId: l.id,
        name: l.name,
        paymentPerDay: Number(l.paymentPerDay),
        type: l.type,
        phonenumber: l.phonenumber,
        amount: String(Number(l.paymentPerDay)),
      }))
    );
    setContractorRows(
      filteredContractors.map((c) => ({
        contractorId: c.id,
        name: c.name,
        type: c.type,
        phonenumber: c.phonenumber,
        amount: "",
      }))
    );
  }, [allLabours, allContractors, showOnlyWeekly]);

  // ── Fetch saved diary history ────────────────────────────────────────────
  // KEY: uses Promise.allSettled so a 404 on contractor-payments (empty table)
  // never kills the labour-payments result. Names are stored as raw IDs and
  // resolved at render time from allLabours / allContractors.
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      // allSettled: each resolves/rejects independently
      const [lpResult, cpResult] = await Promise.allSettled([
        apiRequest.fetchAll<any>("labour-payments"),
        apiRequest.fetchAll<any>("contractor-payments"),
      ]);

      const lpList: any[] = lpResult.status === "fulfilled" && Array.isArray(lpResult.value) ? lpResult.value : [];
      const cpList: any[] = cpResult.status === "fulfilled" && Array.isArray(cpResult.value) ? cpResult.value : [];

      // Filter to only records created via this diary (remark prefix)
      const diaryLP = lpList.filter((p) => p.remarks?.startsWith("Weekly diary"));
      const diaryCP = cpList.filter((p) => p.remarks?.startsWith("Weekly diary"));

      // Group by date (YYYY-MM-DD) — store raw records, names resolved at render
      const dateMap: Record<string, DiaryEntry> = {};

      diaryLP.forEach((p) => {
        const dateKey = new Date(p.paymentDate).toISOString().split("T")[0];
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { date: dateKey, labourPayments: [], contractorPayments: [], totalLabour: 0, totalContractor: 0, grandTotal: 0 };
        }
        dateMap[dateKey].labourPayments.push(p);
        dateMap[dateKey].totalLabour += Number(p.amount);
      });

      diaryCP.forEach((p) => {
        const dateKey = new Date(p.paymentDate).toISOString().split("T")[0];
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = { date: dateKey, labourPayments: [], contractorPayments: [], totalLabour: 0, totalContractor: 0, grandTotal: 0 };
        }
        dateMap[dateKey].contractorPayments.push(p);
        dateMap[dateKey].totalContractor += Number(p.amount);
      });

      const sorted = Object.values(dateMap)
        .map((e) => ({ ...e, grandTotal: e.totalLabour + e.totalContractor }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setDiaryHistory(sorted);
    } catch (err: any) {
      toast({ title: "Failed to load history", description: err.message, variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }, []); // no master-data deps — names resolved at render time

  // Fire on mount unconditionally
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Re-fetch after submit via realtime
  useEffect(() => {
    const labCh = supabase
      .channel("diary-labour-history")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "labour_payments" }, () => fetchHistory())
      .subscribe();
    const conCh = supabase
      .channel("diary-contractor-history")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contractor_payments" }, () => fetchHistory())
      .subscribe();
    return () => {
      supabase.removeChannel(labCh);
      supabase.removeChannel(conCh);
    };
  }, [fetchHistory]);

  const toggleDateExpand = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  // ── Copy from previous Tuesday ──────────────────────────────────────────
  const handleCopyPrevious = async () => {
    const prevTuesday = getPreviousTuesday(selectedDate);
    setCopying(true);
    try {
      const [prevLP, prevCP] = await Promise.all([
        apiRequest.fetchAll<LabourPayment>("labour-payments"),
        apiRequest.fetchAll<ContractorPayment>("contractor-payments"),
      ]);

      const prevStart = new Date(prevTuesday); prevStart.setHours(0, 0, 0, 0);
      const prevEnd   = new Date(prevTuesday); prevEnd.setHours(23, 59, 59, 999);

      const filteredLP = Array.isArray(prevLP)
        ? prevLP.filter((p) => { const d = new Date(p.paymentDate); return d >= prevStart && d <= prevEnd; })
        : [];
      const filteredCP = Array.isArray(prevCP)
        ? prevCP.filter((p) => { const d = new Date(p.paymentDate); return d >= prevStart && d <= prevEnd; })
        : [];

      if (filteredLP.length === 0 && filteredCP.length === 0) {
        toast({ title: "No data found", description: `No records found for ${prevTuesday}. Starting fresh.` });
        return;
      }

      const prevLabourIds      = new Set(filteredLP.map((p) => p.labourId));
      const prevContractorIds  = new Set(filteredCP.map((p) => p.contractorId));

      setLabourRows(
        allLabours.filter((l) => prevLabourIds.has(l.id)).map((l) => {
          const prev = filteredLP.find((p) => p.labourId === l.id);
          return { labourId: l.id, name: l.name, paymentPerDay: Number(l.paymentPerDay), type: l.type, phonenumber: l.phonenumber, amount: prev ? String(Number(prev.amount)) : String(Number(l.paymentPerDay)) };
        })
      );
      setContractorRows(
        allContractors.filter((c) => prevContractorIds.has(c.id)).map((c) => {
          const prev = filteredCP.find((p) => p.contractorId === c.id);
          return { contractorId: c.id, name: c.name, type: c.type, phonenumber: c.phonenumber, amount: prev ? String(Number(prev.amount)) : "" };
        })
      );

      toast({ title: "Copied!", description: `Loaded ${filteredLP.length} labour + ${filteredCP.length} contractor entries from ${prevTuesday}.` });
    } catch (err: any) {
      toast({ title: "Copy failed", description: err.message, variant: "destructive" });
    } finally {
      setCopying(false);
    }
  };

  const removeLabourRow     = (id: string) => setLabourRows((p) => p.filter((r) => r.labourId !== id));
  const removeContractorRow = (id: string) => setContractorRows((p) => p.filter((r) => r.contractorId !== id));
  const updateLabourAmount     = (id: string, v: string) => setLabourRows((p) => p.map((r) => r.labourId === id ? { ...r, amount: v } : r));
  const updateContractorAmount = (id: string, v: string) => setContractorRows((p) => p.map((r) => r.contractorId === id ? { ...r, amount: v } : r));

  // ── Submit all ───────────────────────────────────────────────────────────
  const handleSubmitAll = async () => {
    const invalid = [...labourRows, ...contractorRows].find(
      (r) => !r.amount || isNaN(Number(r.amount)) || Number(r.amount) <= 0
    );
    if (invalid) {
      toast({ title: "Invalid amounts", description: "Please enter a valid positive amount for every row.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const paymentDateISO = new Date(selectedDate).toISOString();
      const labourPayloads = labourRows.map((r) => ({ labourId: r.labourId, amount: Number(r.amount), type: "OUTGOING", paymentDate: paymentDateISO, remarks: `Weekly diary — ${selectedDate}` }));
      const contractorPayloads = contractorRows.map((r) => ({ contractorId: r.contractorId, amount: Number(r.amount), type: "OUTGOING", paymentDate: paymentDateISO, remarks: `Weekly diary — ${selectedDate}` }));

      await Promise.all([
        labourPayloads.length > 0 ? apiRequest.bulkCreate("labour-payments", labourPayloads) : Promise.resolve(),
        contractorPayloads.length > 0 ? apiRequest.bulkCreate("contractor-payments", contractorPayloads) : Promise.resolve(),
      ]);

      toast({ title: "Diary submitted!", description: `Created ${labourPayloads.length} labour + ${contractorPayloads.length} contractor records for ${selectedDate}.` });
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const totalLabour     = labourRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalContractor = contractorRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const grandTotal      = totalLabour + totalContractor;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Weekly Payment Diary
            </h2>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Batch-log Tuesday wage payments for all weekly labours and contractors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2">
            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSubmitted(false); }}
              className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleCopyPrevious} disabled={copying} className="font-bold text-xs gap-1.5">
            {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Copy from Last Tuesday
          </Button>
        </div>
      </div>

      {/* ── TYPE FILTER ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show:</span>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-900 border dark:border-zinc-800 p-1 rounded-xl w-fit">
          {[{ label: "Weekly Only", val: true }, { label: "All Types", val: false }].map(({ label, val }) => (
            <button key={label} type="button" onClick={() => setShowOnlyWeekly(val)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${showOnlyWeekly === val ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SUCCESS BANNER ─────────────────────────────────────────────── */}
      {submitted && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">Payment diary saved!</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 font-medium mt-0.5">Records are visible in the history below and in the payments pages.</p>
          </div>
        </div>
      )}

      {/* ── LABOUR SECTION ─────────────────────────────────────────────── */}
      <Card className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10 flex flex-row items-center gap-2 py-3">
          <Users className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
            Labour Wages — {labourRows.length} workers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {labourRows.length === 0 ? (
            <div className="flex items-center gap-2 py-8 px-5 text-xs text-muted-foreground italic font-medium">
              <AlertCircle className="h-4 w-4" />No {showOnlyWeekly ? "weekly " : ""}labour records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800">
                    {["Name", "Type", "Phone", "Daily Rate", "Amount (₹)", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labourRows.map((row) => (
                    <tr key={row.labourId} className="border-b border-slate-50 dark:border-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-2.5">{typeBadge(row.type)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{row.phonenumber || "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">{formatPrice(row.paymentPerDay)}/day</td>
                      <td className="px-4 py-2.5">
                        <Input type="number" min="1" value={row.amount} onChange={(e) => updateLabourAmount(row.labourId, e.target.value)} className="h-8 text-xs font-semibold w-32" placeholder="0.00" />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button type="button" onClick={() => removeLabourRow(row.labourId)} className="text-slate-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 transition-colors p-1.5 rounded-lg">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {labourRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-zinc-900/30">
                      <td colSpan={4} className="px-4 py-2.5 text-xs font-extrabold text-slate-600 dark:text-zinc-400 text-right uppercase tracking-wider">Labour Subtotal</td>
                      <td className="px-4 py-2.5 text-sm font-extrabold text-amber-600 dark:text-amber-400">{formatPrice(totalLabour)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CONTRACTOR SECTION ─────────────────────────────────────────── */}
      <Card className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10 flex flex-row items-center gap-2 py-3">
          <Briefcase className="h-4 w-4 text-indigo-500" />
          <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
            Contractor Payouts — {contractorRows.length} contractors
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contractorRows.length === 0 ? (
            <div className="flex items-center gap-2 py-8 px-5 text-xs text-muted-foreground italic font-medium">
              <AlertCircle className="h-4 w-4" />No {showOnlyWeekly ? "weekly " : ""}contractor records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800">
                    {["Name", "Type", "Phone", "Amount (₹)", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contractorRows.map((row) => (
                    <tr key={row.contractorId} className="border-b border-slate-50 dark:border-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-2.5">{typeBadge(row.type)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-medium">{row.phonenumber || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Input type="number" min="1" value={row.amount} onChange={(e) => updateContractorAmount(row.contractorId, e.target.value)} className="h-8 text-xs font-semibold w-32" placeholder="Enter amount" />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button type="button" onClick={() => removeContractorRow(row.contractorId)} className="text-slate-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400 transition-colors p-1.5 rounded-lg">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {contractorRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-zinc-900/30">
                      <td colSpan={3} className="px-4 py-2.5 text-xs font-extrabold text-slate-600 dark:text-zinc-400 text-right uppercase tracking-wider">Contractor Subtotal</td>
                      <td className="px-4 py-2.5 text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{formatPrice(totalContractor)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── GRAND TOTAL + SUBMIT ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl px-5 py-4 shadow-sm">
        <div>
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Grand Total Payout</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mt-0.5">{formatPrice(grandTotal)}</p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
            {labourRows.length} labours + {contractorRows.length} contractors for {selectedDate}
          </p>
        </div>
        <Button onClick={handleSubmitAll} disabled={submitting || submitted || (labourRows.length === 0 && contractorRows.length === 0)} className="font-extrabold gap-2 min-w-48" size="lg">
          {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" />Submitting...</>) : submitted ? (<><CheckCircle2 className="h-4 w-4" />Diary Saved</>) : (<>Submit All Payments<ChevronRight className="h-4 w-4" /></>)}
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ── SAVED DIARY RECORDS HISTORY ──────────────────────────────────
          ══════════════════════════════════════════════════════════════════ */}
      <div className="pt-4 border-t border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 mb-5">
          <History className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Payment Records</h3>
          {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
          <span className="ml-auto text-xs text-muted-foreground font-semibold">{diaryHistory.length} date group{diaryHistory.length !== 1 ? "s" : ""}</span>
        </div>

        {diaryHistory.length === 0 && !loadingHistory ? (
          <div className="flex flex-col items-center py-14 text-muted-foreground gap-2">
            <BookOpen className="h-8 w-8 opacity-30" />
            <p className="text-sm font-semibold">No payment records yet.</p>
            <p className="text-xs">Labour and contractor payments will appear here once logged.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {diaryHistory.map((entry) => {
              const isOpen = expandedDates.has(entry.date);
              return (
                <Card key={entry.date} className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm overflow-hidden">
                  {/* Accordion header */}
                  <button
                    type="button"
                    onClick={() => toggleDateExpand(entry.date)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{formatDateLabel(entry.date)}</span>
                    </div>

                    <div className="flex items-center gap-4 ml-auto text-xs font-semibold text-slate-500">
                      {entry.labourPayments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-amber-500" />
                          {entry.labourPayments.length} labours · {formatPrice(entry.totalLabour)}
                        </span>
                      )}
                      {entry.contractorPayments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
                          {entry.contractorPayments.length} contractors · {formatPrice(entry.totalContractor)}
                        </span>
                      )}
                      <span className="font-extrabold text-slate-800 dark:text-slate-100">
                        Total: {formatPrice(entry.grandTotal)}
                      </span>
                    </div>

                    {isOpen
                      ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-slate-100 dark:border-zinc-800">
                      {/* Labour sub-table */}
                      {entry.labourPayments.length > 0 && (
                        <div className="overflow-x-auto">
                          <div className="px-5 pt-3 pb-1 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider">Labour Wages</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-50 dark:border-zinc-900">
                                <th className="text-left px-5 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Name</th>
                                <th className="text-left px-4 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Type</th>
                                <th className="text-right px-5 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.labourPayments.map((p) => {
                                const labour = allLabours.find((l) => l.id === p.labourId);
                                const name = labour?.name || p.labourId;
                                const ltype = (labour?.type || "WEEKLY") as "WEEKLY" | "MONTHLY";
                                return (
                                <tr key={p.id} className="border-b border-slate-50 dark:border-zinc-900/50">
                                  <td className="px-5 py-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">{name}</td>
                                  <td className="px-4 py-2">{typeBadge(ltype)}</td>
                                  <td className="px-5 py-2 text-right font-extrabold text-amber-600 dark:text-amber-400 text-sm">{formatPrice(Number(p.amount))}</td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-amber-50/40 dark:bg-amber-950/10">
                                <td colSpan={2} className="px-5 py-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-right">Labour Subtotal</td>
                                <td className="px-5 py-2 text-right font-extrabold text-amber-700 dark:text-amber-300">{formatPrice(entry.totalLabour)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Contractor sub-table */}
                      {entry.contractorPayments.length > 0 && (
                        <div className="overflow-x-auto border-t border-slate-50 dark:border-zinc-900">
                          <div className="px-5 pt-3 pb-1 flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Contractor Payouts</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-50 dark:border-zinc-900">
                                <th className="text-left px-5 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Name</th>
                                <th className="text-left px-4 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Type</th>
                                <th className="text-right px-5 py-2 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.contractorPayments.map((p) => {
                                const contractor = allContractors.find((c) => c.id === p.contractorId);
                                const name = contractor?.name || p.contractorId;
                                const ctype = (contractor?.type || "WEEKLY") as "WEEKLY" | "MONTHLY";
                                return (
                                <tr key={p.id} className="border-b border-slate-50 dark:border-zinc-900/50">
                                  <td className="px-5 py-2 font-semibold text-slate-800 dark:text-slate-200 text-sm">{name}</td>
                                  <td className="px-4 py-2">{typeBadge(ctype)}</td>
                                  <td className="px-5 py-2 text-right font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">{formatPrice(Number(p.amount))}</td>
                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-indigo-50/40 dark:bg-indigo-950/10">
                                <td colSpan={2} className="px-5 py-2 text-xs font-extrabold text-slate-500 uppercase tracking-wider text-right">Contractor Subtotal</td>
                                <td className="px-5 py-2 text-right font-extrabold text-indigo-700 dark:text-indigo-300">{formatPrice(entry.totalContractor)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Grand total row */}
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800">
                        <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Grand Total for {formatDateLabel(entry.date)}</span>
                        <span className="text-base font-extrabold text-slate-900 dark:text-slate-50">{formatPrice(entry.grandTotal)}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
