import { useState, useEffect, useMemo } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Coins,
  Loader2,
  Trash2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Search,
  Pencil
} from "lucide-react";
import type { Project, Labour, LabourPayment, ProjectPayment } from "@/types/master";
import { supabase } from "@/lib/realtime";

export default function PaymentsPage() {
  const { data: projectsRaw } = useMasterData<Project>("projects");
  const { data: laboursRaw } = useMasterData<Labour>("labours");

  const [activeTab, setActiveTab] = useState<"project" | "labour">("project");
  const { toast } = useToast();

  const projectsList = useMemo(() => Array.isArray(projectsRaw) ? projectsRaw : [], [projectsRaw]);
  const laboursList = useMemo(() => Array.isArray(laboursRaw) ? laboursRaw : [], [laboursRaw]);

  // Lists state
  const [projectPayments, setProjectPayments] = useState<ProjectPayment[]>([]);
  const [labourPayments, setLabourPayments] = useState<LabourPayment[]>([]);
  const [loadingProjectPayments, setLoadingProjectPayments] = useState(false);
  const [loadingLabourPayments, setLoadingLabourPayments] = useState(false);

  // Modal / Dialog state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; type: "project" | "labour"; data: any } | null>(null);

  // Forms state
  const [projProjectId, setProjProjectId] = useState("");
  const [projAmount, setProjAmount] = useState("");
  const [projType, setProjType] = useState<"INCOMING" | "OUTGOING">("INCOMING");
  const [projDate, setProjDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [projRemarks, setProjRemarks] = useState("");
  const [submittingProj, setSubmittingProj] = useState(false);

  const [labLabourId, setLabLabourId] = useState("");
  const [labProjectId, setLabProjectId] = useState("");
  const [labAmount, setLabAmount] = useState("");
  const [labType, setLabType] = useState<"OUTGOING" | "INCOMING">("OUTGOING");
  const [labDate, setLabDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [labRemarks, setLabRemarks] = useState("");
  const [submittingLab, setSubmittingLab] = useState(false);

  // Search/Filters state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");
  const [filterLabourId, setFilterLabourId] = useState("");
  const [filterLabourDisplay, setFilterLabourDisplay] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Form display text state (for SearchableSelect)
  const [projProjectDisplay, setProjProjectDisplay] = useState("");
  const [labLabourDisplay, setLabLabourDisplay] = useState("");
  const [labProjectDisplay, setLabProjectDisplay] = useState("");

  const fetchProjectPayments = async () => {
    setLoadingProjectPayments(true);
    try {
      const logs = await apiRequest.fetchAll<ProjectPayment>("project-payments");
      setProjectPayments(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      toast({
        title: "Error fetching project payments",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoadingProjectPayments(false);
    }
  };

  const fetchLabourPayments = async () => {
    setLoadingLabourPayments(true);
    try {
      const logs = await apiRequest.fetchAll<LabourPayment>("labour-payments");
      setLabourPayments(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      toast({
        title: "Error fetching labour payments",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoadingLabourPayments(false);
    }
  };

  // Real-time synchronization subscriptions
  useEffect(() => {
    fetchProjectPayments();
    fetchLabourPayments();

    const projChannel = supabase
      .channel("db-project-payments-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_payments" },
        () => {
          fetchProjectPayments();
        }
      )
      .subscribe();

    const labChannel = supabase
      .channel("db-labour-payments-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "labour_payments" },
        () => {
          fetchLabourPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projChannel);
      supabase.removeChannel(labChannel);
    };
  }, []);

  const openAddModal = () => {
    setEditingItem(null);
    // Reset forms
    setProjProjectId("");
    setProjAmount("");
    setProjType("INCOMING");
    setProjDate(new Date().toISOString().split("T")[0]);
    setProjRemarks("");

    setLabLabourId("");
    setLabProjectId("");
    setLabAmount("");
    setLabType("OUTGOING");
    setLabDate(new Date().toISOString().split("T")[0]);
    setLabRemarks("");

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // Form handlers
  const handleAddProjectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projProjectId) return;
    const amount = Number(projAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please specify a positive payment amount.",
        variant: "destructive"
      });
      return;
    }

    setSubmittingProj(true);
    try {
      const payload = {
        projectId: projProjectId,
        amount,
        type: projType,
        paymentDate: new Date(projDate).toISOString(),
        remarks: projRemarks || null
      };

      if (editingItem) {
        await apiRequest.delete("project-payments", editingItem.id);
        await apiRequest.create<ProjectPayment>("project-payments", payload as any);
        toast({
          title: "Payment Updated",
          description: "Project payment record has been successfully updated."
        });
      } else {
        await apiRequest.create<ProjectPayment>("project-payments", payload as any);
        toast({
          title: "Payment Recorded",
          description: `Successfully logged Project Transaction of ₹${amount.toLocaleString("en-IN")}.`
        });
      }
      closeModal();
      fetchProjectPayments();
    } catch (err: any) {
      toast({
        title: "Record Payment Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSubmittingProj(false);
    }
  };

  const handleAddLabourPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labLabourId) return;
    const amount = Number(labAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please specify a positive payment amount.",
        variant: "destructive"
      });
      return;
    }

    setSubmittingLab(true);
    try {
      const payload = {
        labourId: labLabourId,
        projectId: labProjectId || null,
        amount,
        type: labType,
        paymentDate: new Date(labDate).toISOString(),
        remarks: labRemarks || null
      };

      if (editingItem) {
        await apiRequest.update("labour-payments", editingItem.id, payload as any);
        toast({
          title: "Payment Updated",
          description: "Labour payment record has been successfully updated."
        });
      } else {
        await apiRequest.create<LabourPayment>("labour-payments", payload as any);
        toast({
          title: "Payment Recorded",
          description: `Successfully logged Labour Transaction of ₹${amount.toLocaleString("en-IN")}.`
        });
      }
      closeModal();
      fetchLabourPayments();
    } catch (err: any) {
      toast({
        title: "Record Payment Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setSubmittingLab(false);
    }
  };

  const handleDeleteProjectPayment = async (id: string, amount: number) => {
    if (!confirm(`Are you sure you want to delete this payment record of ₹${amount.toLocaleString("en-IN")}?`)) return;

    try {
      await apiRequest.delete("project-payments", id);
      toast({
        title: "Payment deleted",
        description: "Successfully removed project payment record."
      });
      fetchProjectPayments();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteLabourPayment = async (id: string, amount: number) => {
    if (!confirm(`Are you sure you want to delete this payment record of ₹${amount.toLocaleString("en-IN")}?`)) return;

    try {
      await apiRequest.delete("labour-payments", id);
      toast({
        title: "Payment deleted",
        description: "Successfully removed labour payment record."
      });
      fetchLabourPayments();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Filtration logic
  const filteredProjectPayments = useMemo(() => {
    return projectPayments.filter((p) => {
      if (filterProjectId && p.projectId !== filterProjectId) return false;
      if (filterDate) {
        const start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
        const d = new Date(p.paymentDate);
        if (d < start || d > end) return false;
      }
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const projectNameMatch = p.project?.name?.toLowerCase().includes(term);
        const remarksMatch = p.remarks?.toLowerCase().includes(term);
        if (!projectNameMatch && !remarksMatch) return false;
      }
      return true;
    });
  }, [projectPayments, filterProjectId, filterDate, filterSearch]);

  const filteredLabourPayments = useMemo(() => {
    return labourPayments.filter((p) => {
      if (filterLabourId && p.labourId !== filterLabourId) return false;
      if (filterProjectId && p.projectId !== filterProjectId) return false;
      if (filterDate) {
        const start = new Date(filterDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filterDate);
        end.setHours(23, 59, 59, 999);
        const d = new Date(p.paymentDate);
        if (d < start || d > end) return false;
      }
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        const remarksMatch = p.remarks?.toLowerCase().includes(term);
        if (!remarksMatch) return false;
      }
      return true;
    });
  }, [labourPayments, filterLabourId, filterProjectId, filterDate, filterSearch]);

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (amount: number) => {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col gap-1.5 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Regular Payments Ledger
            </h2>
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Log client receipts and refunds on project sites, and manage payouts and recoveries for the labour crew.
          </p>
        </div>
        <Button onClick={openAddModal} className="font-bold text-xs">
          <Plus className="h-4 w-4 mr-1.5" />
          Log Transaction
        </Button>
      </div>

      {/* FILTER BAR FOR BOTH TABLES */}
      <Card className="border border-slate-200/60 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
        <CardHeader className="py-4 border-b border-slate-100 dark:border-zinc-900 flex flex-row items-center gap-2">
          <SlidersHorizontal size={14} className="text-primary" />
          <CardTitle className="text-xs font-extrabold uppercase text-slate-600 dark:text-zinc-400 tracking-wider">
            Ledger Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 flex flex-wrap gap-4 items-end">
          <div className="space-y-1 w-full sm:w-56">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Search Remarks</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter comments or remarks..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="h-9 text-xs pl-8"
              />
            </div>
          </div>
          <div className="space-y-1 w-full sm:w-48">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Project Site</label>
            <SearchableSelect
              value={filterProjectId}
              displayValue={filterProjectDisplay}
              options={projectsList
                .filter((p) => !filterProjectDisplay || p.name.toLowerCase().includes(filterProjectDisplay.toLowerCase()))
                .slice(0, 10)
                .map((p) => ({ id: p.id, label: p.name }))}
              placeholder="All Projects"
              allLabel="All Projects"
              onSearchChange={setFilterProjectDisplay}
              onSelect={(id, label) => { setFilterProjectId(id); setFilterProjectDisplay(id ? label : ""); }}
              onClear={() => { setFilterProjectId(""); setFilterProjectDisplay(""); }}
              inputHeight="h-9"
              textSize="text-xs"
            />
          </div>
          {activeTab === "labour" && (
            <div className="space-y-1 w-full sm:w-48">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase">Labour Worker</label>
              <SearchableSelect
                value={filterLabourId}
                displayValue={filterLabourDisplay}
                options={laboursList
                  .filter((l) => !filterLabourDisplay || l.name.toLowerCase().includes(filterLabourDisplay.toLowerCase()))
                  .slice(0, 10)
                  .map((l) => ({ id: l.id, label: l.name }))}
                placeholder="All Labours"
                allLabel="All Labours"
                onSearchChange={setFilterLabourDisplay}
                onSelect={(id, label) => { setFilterLabourId(id); setFilterLabourDisplay(id ? label : ""); }}
                onClear={() => { setFilterLabourId(""); setFilterLabourDisplay(""); }}
                inputHeight="h-9"
                textSize="text-xs"
              />
            </div>
          )}
          <div className="space-y-1 w-full sm:w-40">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase">Log Date</label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterSearch("");
              setFilterProjectId("");
              setFilterLabourId("");
              setFilterDate("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold h-9 ml-auto"
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 dark:bg-zinc-900 rounded-xl p-1">
          <TabsTrigger value="project" className="rounded-lg font-bold text-xs">
            <ArrowUpRight className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
            Project Receipts & Refunds
          </TabsTrigger>
          <TabsTrigger value="labour" className="rounded-lg font-bold text-xs">
            <ArrowDownLeft className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
            Labour Wages & Recoveries
          </TabsTrigger>
        </TabsList>

        {/* PROJECT RECEIPTS & REFUNDS */}
        <TabsContent value="project" className="space-y-6">
          <Card className="border border-slate-200 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
              <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
                Project Receipts Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingProjectPayments ? (
                <div className="flex flex-col items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-xs font-medium text-muted-foreground">Loading transactions...</span>
                </div>
              ) : filteredProjectPayments.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-xs italic font-medium">
                  No transactions match the specified filter parameters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project / Site</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjectPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                          {p.project?.name || "Unknown Site"}
                        </TableCell>
                        <TableCell className="font-medium text-muted-foreground text-xs">
                          {formatDate(p.paymentDate)}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          {p.remarks || "—"}
                        </TableCell>
                        <TableCell className={`text-right font-extrabold ${p.type === "OUTGOING" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {p.type === "OUTGOING" ? "-" : "+"}{formatPrice(Number(p.amount))}
                        </TableCell>
                        <TableCell className="text-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem({ id: p.id, type: "project", data: p });
                              setProjProjectId(p.projectId);
                              setProjAmount(p.amount.toString());
                              setProjType(p.type);
                              setProjDate(p.paymentDate.split("T")[0]);
                              setProjRemarks(p.remarks || "");
                              setIsModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProjectPayment(p.id, Number(p.amount))}
                            className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LABOUR WAGES & RECOVERIES */}
        <TabsContent value="labour" className="space-y-6">
          <Card className="border border-slate-200 bg-white dark:bg-zinc-950 shadow-sm rounded-2xl">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-zinc-900/10">
              <CardTitle className="text-xs font-extrabold tracking-wide uppercase text-slate-700 dark:text-zinc-300">
                Labour Payouts Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLabourPayments ? (
                <div className="flex flex-col items-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <span className="text-xs font-medium text-muted-foreground">Loading logs...</span>
                </div>
              ) : filteredLabourPayments.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-xs italic font-medium">
                  No logs match the specified filter parameters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Labour Crew</TableHead>
                      <TableHead>Associated Site</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-24 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLabourPayments.map((p) => {
                      const labourName = laboursList.find((l) => l.id === p.labourId)?.name || "Worker";
                      const siteName = projectsList.find((pr) => pr.id === p.projectId)?.name || "General";
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                            {labourName}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-500 text-xs">
                            {siteName}
                          </TableCell>
                          <TableCell className="font-medium text-muted-foreground text-xs">
                            {formatDate(p.paymentDate)}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {p.remarks || "—"}
                          </TableCell>
                          <TableCell className={`text-right font-extrabold ${p.type === "INCOMING" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {p.type === "INCOMING" ? "+" : "-"}{formatPrice(Number(p.amount))}
                          </TableCell>
                          <TableCell className="text-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem({ id: p.id, type: "labour", data: p });
                                setLabLabourId(p.labourId);
                                setLabProjectId(p.projectId || "");
                                setLabAmount(p.amount.toString());
                                setLabType(p.type);
                                setLabDate(p.paymentDate.split("T")[0]);
                                setLabRemarks(p.remarks || "");
                                setIsModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-2 rounded-lg transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLabourPayment(p.id, Number(p.amount))}
                              className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DYNAMIC TRANSACTION POP-UP MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Transaction Entry" : "Log New Transaction"}
            </DialogTitle>
          </DialogHeader>

          {activeTab === "project" ? (
            <form onSubmit={handleAddProjectPayment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Project Site *
                </label>
                <SearchableSelect
                  value={projProjectId}
                  displayValue={projProjectDisplay}
                  options={projectsList
                    .filter((p) => !projProjectDisplay || p.name.toLowerCase().includes(projProjectDisplay.toLowerCase()))
                    .slice(0, 10)
                    .map((p) => ({ id: p.id, label: p.name }))}
                  placeholder="Select Project Site..."
                  onSearchChange={setProjProjectDisplay}
                  onSelect={(id, label) => { setProjProjectId(id); setProjProjectDisplay(label); }}
                  onClear={() => { setProjProjectId(""); setProjProjectDisplay(""); }}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Transaction Type *
                </label>
                <select
                  value={projType}
                  onChange={(e) => setProjType(e.target.value as any)}
                  required
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-sm font-semibold focus:outline-none"
                >
                  <option value="INCOMING">Incoming Payment (Client Receipt)</option>
                  <option value="OUTGOING">Outgoing Payment (Client Refund)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Amount (₹) *
                </label>
                <Input
                  type="number"
                  required
                  min="1"
                  placeholder="0.00"
                  value={projAmount}
                  onChange={(e) => setProjAmount(e.target.value)}
                  className="font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  required
                  value={projDate}
                  onChange={(e) => setProjDate(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Remarks / Notes
                </label>
                <Input
                  placeholder="e.g. Bank transfer, part payment"
                  value={projRemarks}
                  onChange={(e) => setProjRemarks(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingProj}>
                  {submittingProj ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    editingItem ? "Save Changes" : "Log Transaction"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddLabourPayment} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Select Labour *
                </label>
                <SearchableSelect
                  value={labLabourId}
                  displayValue={labLabourDisplay}
                  options={laboursList
                    .filter((l) => !labLabourDisplay || l.name.toLowerCase().includes(labLabourDisplay.toLowerCase()))
                    .slice(0, 10)
                    .map((l) => ({ id: l.id, label: l.name }))}
                  placeholder="Choose worker..."
                  onSearchChange={setLabLabourDisplay}
                  onSelect={(id, label) => { setLabLabourId(id); setLabLabourDisplay(label); }}
                  onClear={() => { setLabLabourId(""); setLabLabourDisplay(""); }}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Associated Project (Optional)
                </label>
                <SearchableSelect
                  value={labProjectId}
                  displayValue={labProjectDisplay}
                  options={projectsList
                    .filter((p) => !labProjectDisplay || p.name.toLowerCase().includes(labProjectDisplay.toLowerCase()))
                    .slice(0, 10)
                    .map((p) => ({ id: p.id, label: p.name }))}
                  placeholder="General (No specific site)"
                  allLabel="General (No specific site)"
                  onSearchChange={setLabProjectDisplay}
                  onSelect={(id, label) => { setLabProjectId(id); setLabProjectDisplay(id ? label : ""); }}
                  onClear={() => { setLabProjectId(""); setLabProjectDisplay(""); }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Transaction Type *
                </label>
                <select
                  value={labType}
                  onChange={(e) => setLabType(e.target.value as any)}
                  required
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-zinc-800 bg-transparent px-3 text-sm font-semibold focus:outline-none"
                >
                  <option value="OUTGOING">Outgoing Payment (Wage/Salary Payout)</option>
                  <option value="INCOMING">Incoming Payment (Wage Recovery/Refund)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Amount (₹) *
                </label>
                <Input
                  type="number"
                  required
                  min="1"
                  placeholder="0.00"
                  value={labAmount}
                  onChange={(e) => setLabAmount(e.target.value)}
                  className="font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  required
                  value={labDate}
                  onChange={(e) => setLabDate(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Remarks / Notes
                </label>
                <Input
                  placeholder="e.g. Weekly settlement, advance recovery"
                  value={labRemarks}
                  onChange={(e) => setLabRemarks(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingLab}>
                  {submittingLab ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    editingItem ? "Save Changes" : "Log Transaction"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
