import { useState, useMemo, useRef } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Labour, Project, LabourAttendance } from "../../types/master";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { 
  Users, 
  Calendar, 
  MapPin, 
  UserCheck, 
  UserX, 
  Building, 
  Search, 
  Clock, 
  AlertCircle,
  Activity,
  ChevronRight,
  Phone,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type DetailModalType = "WORKFORCE" | "PRESENT" | "ABSENT" | "SITES" | null;

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function LabourDailyLogPage() {
  // Local state for selected date
  const [selectedDate, setSelectedDate] = useState(() => getTodayString());
  
  // State for search query & status filter in side panel
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

  // State for stat cards detail modal
  const [activeDetailModal, setActiveDetailModal] = useState<DetailModalType>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleOpenPicker = () => {
    try {
      dateInputRef.current?.showPicker();
    } catch {}
  };

  // Fetch Labours, Projects, and Attendance for the selected date
  const { data: laboursRaw = [], isLoading: laboursLoading } = useMasterData<Labour>("labours");
  const { data: projectsRaw = [], isLoading: projectsLoading } = useMasterData<Project>("projects");
  const { data: attendanceRaw = [], isLoading: attendanceLoading } = useMasterData<LabourAttendance>(
    "labour-attendance",
    true,
    { date: selectedDate }
  );

  const allLabours = useMemo(() => (Array.isArray(laboursRaw) ? laboursRaw : []), [laboursRaw]);
  const allProjects = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);
  const allAttendance = useMemo(() => (Array.isArray(attendanceRaw) ? attendanceRaw : []), [attendanceRaw]);

  // Project map for quick lookup
  const projectMap = useMemo(() => {
    return new Map(allProjects.map((p) => [p.id, p]));
  }, [allProjects]);

  // Map of present labours on the selected date
  const presentMap = useMemo(() => {
    const map = new Map<string, LabourAttendance>();
    allAttendance.forEach((att) => {
      if (att && att.labourId) {
        map.set(att.labourId, att);
      }
    });
    return map;
  }, [allAttendance]);

  // Group present labours by project with defensive fallbacks
  const siteAllocations = useMemo(() => {
    const groups: Record<string, { project: Project | null; attendants: LabourAttendance[] }> = {};
    
    allAttendance.forEach((att) => {
      if (!att) return;
      const pId = att.projectId || "unassigned";
      if (!groups[pId]) {
        groups[pId] = {
          project: pId !== "unassigned" ? projectMap.get(pId) || null : null,
          attendants: []
        };
      }
      groups[pId].attendants.push(att);
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.project?.name || "Unassigned Site";
      const nameB = b.project?.name || "Unassigned Site";
      return nameA.localeCompare(nameB);
    });
  }, [allAttendance, projectMap]);

  // Process status for all labours list (includes present labours even if missing from master list)
  const laboursStatusList = useMemo(() => {
    const map = new Map<string, { labour: Partial<Labour>; isPresent: boolean; attendance?: LabourAttendance; project?: Project | null }>();

    // 1. Populate registered labours from master list
    allLabours.forEach((labour) => {
      if (!labour || !labour.id) return;
      const attendance = presentMap.get(labour.id);
      const isPresent = Boolean(attendance);
      const project = attendance ? projectMap.get(attendance.projectId) : null;
      map.set(labour.id, { labour, isPresent, attendance, project });
    });

    // 2. Safeguard: Add any present labour from attendance records if not already in master list
    allAttendance.forEach((att) => {
      if (att && att.labourId && !map.has(att.labourId)) {
        const project = projectMap.get(att.projectId) || null;
        map.set(att.labourId, {
          labour: att.labour || { id: att.labourId, name: `Worker ${att.labourId.slice(0, 6)}`, paymentPerDay: 0, type: "WEEKLY" },
          isPresent: true,
          attendance: att,
          project
        });
      }
    });

    return Array.from(map.values());
  }, [allLabours, allAttendance, presentMap, projectMap]);

  // Filtered status list for side panel search & filter
  const filteredStatusList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return laboursStatusList.filter((item) => {
      const lName = (item.labour?.name || "").toLowerCase();
      const lPhone = item.labour?.phonenumber || "";
      const matchesSearch = !q || lName.includes(q) || lPhone.includes(q);

      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "PRESENT" && item.isPresent) ||
        (statusFilter === "ABSENT" && !item.isPresent);

      return matchesSearch && matchesStatus;
    });
  }, [laboursStatusList, searchQuery, statusFilter]);

  // Summary counts
  const totalCount = laboursStatusList.length;
  const presentCount = useMemo(() => laboursStatusList.filter((i) => i.isPresent).length, [laboursStatusList]);
  const absentCount = useMemo(() => laboursStatusList.filter((i) => !i.isPresent).length, [laboursStatusList]);
  const activeSitesCount = siteAllocations.length;

  const isLoading = laboursLoading || projectsLoading || attendanceLoading;

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return "Today";
    const d = new Date(selectedDate);
    if (isNaN(d.getTime())) return selectedDate;
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedDate]);

  return (
    <div className="p-6 space-y-6">
      {/* Header section with Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            Labour Daily Allocation & Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track daily attendance, present/absent statuses, and site allocations. Click any summary card to view detailed drill-down lists.
          </p>
        </div>

        {/* Date Selector input */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Date:</label>
          <div className="relative">
            <Calendar 
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-blue-600 transition-colors z-10" 
              onClick={handleOpenPicker}
            />
            <Input
              ref={dateInputRef}
              type="date"
              max={getTodayString()}
              value={selectedDate}
              onChange={(e) => {
                const val = e.target.value;
                const today = getTodayString();
                if (val > today) {
                  setSelectedDate(today);
                } else {
                  setSelectedDate(val);
                }
              }}
              onClick={handleOpenPicker}
              className="pl-9 pr-3 h-9 text-sm w-48 font-semibold shadow-sm focus:ring-1 focus:ring-primary border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hide-native-picker"
            />
          </div>
        </div>
      </div>

      {/* Summary Stat Cards (Interactive & Clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card
          onClick={() => { setActiveDetailModal("WORKFORCE"); setModalSearchQuery(""); }}
          className="p-4 flex items-center justify-between border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 group-hover:text-blue-600 transition-colors">
              Total Workforce <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-200">{totalCount}</h3>
            <p className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">Click to view directory</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card
          onClick={() => { setActiveDetailModal("PRESENT"); setModalSearchQuery(""); }}
          className="p-4 flex items-center justify-between border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              Present Today <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-200">{presentCount}</h3>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">Click to view present</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-450 group-hover:bg-emerald-100 transition-colors">
            <UserCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card
          onClick={() => { setActiveDetailModal("ABSENT"); setModalSearchQuery(""); }}
          className="p-4 flex items-center justify-between border-rose-100 dark:border-rose-950 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm cursor-pointer hover:border-rose-400 dark:hover:border-rose-700 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
              Absent Today <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-xl font-bold text-rose-950 dark:text-rose-200">{absentCount}</h3>
            <p className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold">Click to view absent</p>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-450 group-hover:bg-rose-100 transition-colors">
            <UserX className="h-5 w-5" />
          </div>
        </Card>

        <Card
          onClick={() => { setActiveDetailModal("SITES"); setModalSearchQuery(""); }}
          className="p-4 flex items-center justify-between border-blue-100 dark:border-blue-950 bg-blue-50/20 dark:bg-blue-950/10 shadow-sm cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md transition-all active:scale-[0.99] group"
        >
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1">
              Active Sites <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
            <h3 className="text-xl font-bold text-blue-950 dark:text-blue-200">{activeSitesCount}</h3>
            <p className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold">Click to view sites</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-450 group-hover:bg-blue-100 transition-colors">
            <Building className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground font-semibold">Loading daily allocation log...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Middle: Site-Wise Allocation (Col 1-2) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                <Building className="h-4.5 w-4.5 text-blue-600" />
                Active Site Allocations
              </h2>
              <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200/40">
                {siteAllocations.length} Active Sites
              </span>
            </div>

            {siteAllocations.length === 0 ? (
              <div className="bg-slate-50/50 dark:bg-zinc-900/10 border border-dashed rounded-xl py-12 text-center text-xs text-muted-foreground italic font-medium flex flex-col items-center justify-center gap-2">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <span>No active site allocations recorded for {selectedDateLabel}.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {siteAllocations.map(({ project, attendants }) => (
                  <Card key={project?.id || "unknown"} className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-xl overflow-hidden flex flex-col justify-between">
                    <div className="p-4 border-b bg-slate-50/50 dark:bg-zinc-900/10">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                        {project?.name || "Unassigned Site"}
                      </h3>
                      {project?.customer?.name && (
                        <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                          Client: {project.customer.name}
                        </p>
                      )}
                    </div>

                    <div className="p-4 flex-1 space-y-2.5 max-h-60 overflow-y-auto">
                      {attendants.map((att) => (
                        <div key={att.id || Math.random().toString()} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{att.labour?.name || "Worker"}</p>
                            {att.labour?.phonenumber && (
                              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{att.labour.phonenumber}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge className="text-[9px] font-bold px-1.5 py-0 uppercase tracking-tight bg-blue-100 text-blue-800 border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                              {att.workDayType === "BOTH" ? "Day & Night" : att.workDayType || "DAY"}
                            </Badge>
                            {att.markedBy?.username && (
                              <span className="text-[8px] text-muted-foreground font-semibold flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> By {att.markedBy.username}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 border-t bg-slate-50/30 dark:bg-zinc-900/5 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Site Workforce</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-450 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded-md border border-blue-200/20">
                        {attendants.length} Present
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right: Master Status List (Col 3) */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-blue-600" />
                Workforce Log
              </h2>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search labourer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8.5 h-9 text-xs border-slate-200 dark:border-zinc-800 focus:ring-1 focus:ring-primary w-full bg-white dark:bg-zinc-900 shadow-sm"
                />
              </div>

              {/* Status Filter Toggle Tills */}
              <div className="grid grid-cols-3 gap-1">
                {(["ALL", "PRESENT", "ABSENT"] as const).map((filter) => {
                  const isActive = statusFilter === filter;
                  const label = filter === "ALL" ? "All" : filter === "PRESENT" ? "Present" : "Absent";
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={`h-7 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all duration-200 ${
                        isActive
                          ? "bg-blue-600 text-white border-blue-700 shadow-sm scale-[1.02]"
                          : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-950"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List entries */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredStatusList.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground italic font-medium">
                  No matching labours found.
                </div>
              ) : (
                filteredStatusList.map(({ labour, isPresent, project }) => (
                  <div
                    key={labour.id || Math.random().toString()}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isPresent
                        ? "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        : "bg-slate-50/40 dark:bg-zinc-900/10 border-slate-100 dark:border-zinc-900 opacity-70"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">{labour.name || "Worker"}</p>
                      {isPresent && project ? (
                        <p className="text-[10px] text-blue-600 dark:text-blue-450 font-bold flex items-center gap-0.5 mt-0.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {project.name}
                        </p>
                      ) : (
                        <p className="text-[9px] text-muted-foreground font-semibold mt-0.5 flex items-center gap-0.5">
                          <UserX className="h-3 w-3 text-rose-500 shrink-0" />
                          Not allocated today
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isPresent ? (
                        <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <UserCheck className="h-3 w-3" />
                          Present
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-50 hover:bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <UserX className="h-3 w-3" />
                          Absent
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog Modal for Summary Cards */}
      <Dialog open={Boolean(activeDetailModal)} onOpenChange={(open) => !open && setActiveDetailModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-slate-200 dark:border-zinc-800">
          <DialogHeader className="p-4 sm:p-5 border-b bg-slate-50/70 dark:bg-zinc-900/70">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              {activeDetailModal === "WORKFORCE" && <Users className="h-5 w-5 text-blue-600" />}
              {activeDetailModal === "PRESENT" && <UserCheck className="h-5 w-5 text-emerald-600" />}
              {activeDetailModal === "ABSENT" && <UserX className="h-5 w-5 text-rose-600" />}
              {activeDetailModal === "SITES" && <Building className="h-5 w-5 text-blue-600" />}
              <span>
                {activeDetailModal === "WORKFORCE" && `Total Workforce Directory (${totalCount})`}
                {activeDetailModal === "PRESENT" && `Present Labour Details (${presentCount})`}
                {activeDetailModal === "ABSENT" && `Absent Labour Details (${absentCount})`}
                {activeDetailModal === "SITES" && `Active Site Allocations (${activeSitesCount})`}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Allocation Date: {selectedDateLabel}
            </DialogDescription>

            {activeDetailModal !== "SITES" && (
              <div className="relative mt-3">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter details by name, phone or site..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>
            )}
          </DialogHeader>

          <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh] space-y-3">
            {/* WORKFORCE MODAL CONTENT */}
            {activeDetailModal === "WORKFORCE" && (
              <div className="space-y-2">
                {laboursStatusList.filter((item) => {
                  const q = modalSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  const lName = (item.labour?.name || "").toLowerCase();
                  const lPhone = item.labour?.phonenumber || "";
                  const pName = (item.project?.name || "").toLowerCase();
                  return lName.includes(q) || lPhone.includes(q) || pName.includes(q);
                }).length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    No workforce entries match "{modalSearchQuery}".
                  </div>
                ) : (
                  laboursStatusList
                    .filter((item) => {
                      const q = modalSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const lName = (item.labour?.name || "").toLowerCase();
                      const lPhone = item.labour?.phonenumber || "";
                      const pName = (item.project?.name || "").toLowerCase();
                      return lName.includes(q) || lPhone.includes(q) || pName.includes(q);
                    })
                    .map(({ labour, isPresent, project }) => (
                      <div key={labour.id || Math.random().toString()} className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{labour.name || "Worker"}</span>
                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${labour.type === "MONTHLY" ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"}`}>
                              {labour.type || "WEEKLY"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-semibold">
                            <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {labour.phonenumber || "—"}</span>
                            {labour.paymentPerDay ? <span>Daily: ₹{labour.paymentPerDay}</span> : null}
                            {labour.tuesdayPaymentAmount && Number(labour.tuesdayPaymentAmount) > 0 ? (
                              <span>Tuesday: ₹{labour.tuesdayPaymentAmount}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {isPresent ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[9px] font-bold">
                              <UserCheck className="h-3 w-3 mr-1" /> {project ? project.name : "Present"}
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-[9px] font-bold">
                              <UserX className="h-3 w-3 mr-1" /> Absent
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* PRESENT MODAL CONTENT */}
            {activeDetailModal === "PRESENT" && (
              <div className="space-y-2">
                {presentCount === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    No workers are marked present for {selectedDateLabel}.
                  </div>
                ) : laboursStatusList.filter((item) => {
                  if (!item.isPresent) return false;
                  const q = modalSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  const lName = (item.labour?.name || "").toLowerCase();
                  const lPhone = item.labour?.phonenumber || "";
                  const pName = (item.project?.name || "").toLowerCase();
                  return lName.includes(q) || lPhone.includes(q) || pName.includes(q);
                }).length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    No present workers match "{modalSearchQuery}".
                  </div>
                ) : (
                  laboursStatusList
                    .filter((item) => {
                      if (!item.isPresent) return false;
                      const q = modalSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const lName = (item.labour?.name || "").toLowerCase();
                      const lPhone = item.labour?.phonenumber || "";
                      const pName = (item.project?.name || "").toLowerCase();
                      return lName.includes(q) || lPhone.includes(q) || pName.includes(q);
                    })
                    .map(({ labour, attendance, project }) => (
                      <div key={labour.id || Math.random().toString()} className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{labour.name || "Worker"}</span>
                            {labour.phonenumber && <span className="text-[10px] text-muted-foreground font-medium">({labour.phonenumber})</span>}
                          </div>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 mt-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {project ? project.name : "Allocated Site"}
                          </p>
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 text-[9px] font-bold uppercase">
                            Shift: {attendance?.workDayType === "BOTH" ? "Day & Night" : attendance?.workDayType || "DAY"}
                          </Badge>
                          {attendance?.markedBy?.username && (
                            <p className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1 justify-end">
                              <Clock className="h-2.5 w-2.5" /> Marked by {attendance.markedBy.username}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* ABSENT MODAL CONTENT */}
            {activeDetailModal === "ABSENT" && (
              <div className="space-y-2">
                {absentCount === 0 ? (
                  <div className="py-12 text-center text-xs text-emerald-600 font-bold flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <span>100% Attendance! All registered workers are allocated today.</span>
                  </div>
                ) : laboursStatusList.filter((item) => {
                  if (item.isPresent) return false;
                  const q = modalSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  const lName = (item.labour?.name || "").toLowerCase();
                  const lPhone = item.labour?.phonenumber || "";
                  return lName.includes(q) || lPhone.includes(q);
                }).length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic">
                    No absent workers match "{modalSearchQuery}".
                  </div>
                ) : (
                  laboursStatusList
                    .filter((item) => {
                      if (item.isPresent) return false;
                      const q = modalSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const lName = (item.labour?.name || "").toLowerCase();
                      const lPhone = item.labour?.phonenumber || "";
                      return lName.includes(q) || lPhone.includes(q);
                    })
                    .map(({ labour }) => (
                      <div key={labour.id || Math.random().toString()} className="p-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 flex items-center justify-between gap-3 shadow-2xs">
                        <div>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{labour.name || "Worker"}</span>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-semibold">
                            <span>Phone: {labour.phonenumber || "—"}</span>
                            <span>Type: {labour.type || "WEEKLY"}</span>
                            {labour.paymentPerDay ? <span>Daily Rate: ₹{labour.paymentPerDay}</span> : null}
                          </div>
                        </div>
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 text-[9px] font-bold">
                          <UserX className="h-3 w-3 mr-1" /> Not Allocated
                        </Badge>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* SITES MODAL CONTENT */}
            {activeDetailModal === "SITES" && (
              <div className="space-y-3">
                {activeSitesCount === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground italic flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                    <span>No active site allocations for {selectedDateLabel}.</span>
                  </div>
                ) : (
                  siteAllocations.map(({ project, attendants }) => (
                    <div key={project?.id || Math.random().toString()} className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            {project?.name || "Unassigned Site"}
                          </h4>
                          {project?.customer?.name && (
                            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                              Client: {project.customer.name}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-extrabold">
                          {attendants.length} Workers Present
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {attendants.map((att) => (
                          <div key={att.id || Math.random().toString()} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">{att.labour?.name || "Worker"}</span>
                              {att.labour?.phonenumber && (
                                <span className="text-[9px] text-muted-foreground font-medium">{att.labour.phonenumber}</span>
                              )}
                            </div>
                            <span className="text-[9px] font-bold uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/40">
                              {att.workDayType || "DAY"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
