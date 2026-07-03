import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { apiRequest } from "../../lib/api";
import type { Project, Labour, LabourAttendance } from "../../types/master";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "../../hooks/use-toast";
import {
  Calendar,
  Search,
  UserPlus,
  Copy,
  Trash2,
  X,
  ClipboardCheck,
  Building,
  Users,
  Loader2,
  ChevronDown,
  Filter,
} from "lucide-react";

// Format date helper: "dd MMM yyyy"
const formatDate = (dateStr: any) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

export default function LabourAttendancePage() {
  const { data: projectsData } = useMasterData<Project>("projects");
  const { data: laboursData } = useMasterData<Labour>("labours");

  // State for all attendance records
  const [attendanceList, setAttendanceList] = useState<LabourAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Form Fields State
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [copyFromDate, setCopyFromDate] = useState("");
  // Temporary queue states before marking present
  const [tempSelectedLabours, setTempSelectedLabours] = useState<Labour[]>([]);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  // Site (Project) search dropdown states
  const [projectSearch, setProjectSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectSearching, setProjectSearching] = useState(false);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const projectRef = useRef<HTMLDivElement>(null);

  // Labour search dropdown states
  const [labourSearch, setLabourSearch] = useState("");
  const [labourOpen, setLabourOpen] = useState(false);
  const labourRef = useRef<HTMLDivElement>(null);

  // Filters State
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");

  // Sync projects list
  useEffect(() => {
    if (projectsData) {
      setProjectsList(projectsData);
    }
  }, [projectsData]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
      if (labourRef.current && !labourRef.current.contains(e.target as Node)) {
        setLabourOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch all attendance records from backend
  const fetchAttendance = async () => {
    setLoadingAttendance(true);
    try {
      const res = await apiRequest.fetchAll<LabourAttendance>("labour-attendance");
      setAttendanceList(res || []);
    } catch (err: any) {
      toast({
        title: "Failed to load attendance history",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Project server-side search on Enter
  const searchProjectsFromServer = async (term: string) => {
    if (!term.trim()) return;
    setProjectSearching(true);
    try {
      const results = await apiRequest.fetchAll<Project>("projects", { search: term });
      const incoming = Array.isArray(results) ? results : [];
      setProjectsList((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        incoming.forEach((p) => map.set(p.id, p));
        return Array.from(map.values());
      });
      setProjectOpen(true);
    } catch {
      // ignore
    } finally {
      setProjectSearching(false);
    }
  };

  // Queue Labour locally before saving
  const handleQueueLabour = (labour: Labour) => {
    if (!selectedProject) {
      toast({
        title: "Site required",
        description: "Please choose a project site first.",
        variant: "destructive",
      });
      return;
    }

    // Check if already queued
    if (tempSelectedLabours.some((l) => l.id === labour.id)) {
      toast({
        title: "Labourer already queued",
        description: `"${labour.name}" is already in the list to be added.`,
        variant: "destructive",
      });
      setLabourOpen(false);
      return;
    }

    // Check if duplicate on same date & project in existing attendance
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23,59,59,999);

    const isDuplicate = attendanceList.some((a) => {
      const aDate = new Date(a.date);
      return (
        a.projectId === selectedProject.id &&
        a.labourId === labour.id &&
        aDate >= startOfDay &&
        aDate <= endOfDay
      );
    });

    if (isDuplicate) {
      toast({
        title: "Labourer already present",
        description: `"${labour.name}" is already marked present for today.`,
        variant: "destructive",
      });
      setLabourOpen(false);
      return;
    }

    setTempSelectedLabours((prev) => [...prev, labour]);
    setLabourOpen(false);
    setLabourSearch("");
  };

  const handleRemoveFromQueue = (labourId: string) => {
    setTempSelectedLabours((prev) => prev.filter((l) => l.id !== labourId));
  };

  const handleSaveAttendance = async () => {
    if (!selectedProject || tempSelectedLabours.length === 0) return;

    setSubmittingAttendance(true);
    let successCount = 0;
    const newRecords: LabourAttendance[] = [];

    for (const labour of tempSelectedLabours) {
      try {
        const payload = {
          date: new Date(currentDate).toISOString(),
          projectId: selectedProject.id,
          labourId: labour.id,
        };

        const result = await apiRequest.create<LabourAttendance>("labour-attendance", payload as any);

        const fullRecord: LabourAttendance = {
          ...payload,
          ...result,
          project: { name: selectedProject.name },
          labour: {
            name: labour.name,
            paymentPerDay: Number(labour.paymentPerDay),
            phonenumber: labour.phonenumber,
          },
        };
        newRecords.push(fullRecord);
        successCount++;
      } catch (err: any) {
        toast({
          title: `Failed to mark ${labour.name}`,
          description: err.message || "An error occurred.",
          variant: "destructive",
        });
      }
    }

    if (successCount > 0) {
      setAttendanceList((prev) => [...newRecords, ...prev]);
      toast({
        title: "Attendance marked",
        description: `Successfully added ${successCount} worker(s) to today's site.`,
      });
      setTempSelectedLabours([]);
    }
    setSubmittingAttendance(false);
  };

  // Delete/Remove attendance record
  const handleDeleteAttendance = async (attendanceId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from this attendance record?`)) {
      return;
    }

    try {
      await apiRequest.delete("labour-attendance", attendanceId);
      setAttendanceList((prev) => prev.filter((a) => a.id !== attendanceId));
      toast({
        title: "Attendance removed",
        description: `Removed "${name}" from records.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to remove record",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  // Copy names logic
  const handleCopyNames = async () => {
    if (!selectedProject) {
      toast({
        title: "Site required",
        description: "Choose a project site to copy attendance lists for.",
        variant: "destructive",
      });
      return;
    }
    if (!copyFromDate) {
      toast({
        title: "Date required",
        description: "Please specify a past date to copy from.",
        variant: "destructive",
      });
      return;
    }

    // Filter past date records from attendanceList
    const startOfCopy = new Date(copyFromDate);
    startOfCopy.setHours(0,0,0,0);
    const endOfCopy = new Date(copyFromDate);
    endOfCopy.setHours(23,59,59,999);

    const pastRecords = attendanceList.filter((a) => {
      const d = new Date(a.date);
      return a.projectId === selectedProject.id && d >= startOfCopy && d <= endOfCopy;
    });

    if (pastRecords.length === 0) {
      toast({
        title: "No source attendance",
        description: `No attendance logs found for "${formatDate(copyFromDate)}".`,
        variant: "destructive",
      });
      return;
    }

    // Filter out names already marked on the target date
    const startOfTarget = new Date(currentDate);
    startOfTarget.setHours(0,0,0,0);
    const endOfTarget = new Date(currentDate);
    endOfTarget.setHours(23,59,59,999);

    const targetLabourIds = new Set(
      attendanceList
        .filter((a) => {
          const d = new Date(a.date);
          return a.projectId === selectedProject.id && d >= startOfTarget && d <= endOfTarget;
        })
        .map((a) => a.labourId)
    );

    const labourersToCopy = pastRecords.filter((r) => !targetLabourIds.has(r.labourId));

    if (labourersToCopy.length === 0) {
      toast({
        title: "Names already copied",
        description: "All labourers from that date are already marked present for the target date.",
      });
      return;
    }

    try {
      const payload = labourersToCopy.map((r) => ({
        date: new Date(currentDate).toISOString(),
        projectId: selectedProject.id,
        labourId: r.labourId,
      }));

      const results = await apiRequest.bulkCreate<LabourAttendance>("labour-attendance", payload as any);
      
      // Update local state with relations pre-filled from local lists
      const formattedResults = results.map((res, i) => {
        const originalInput = payload[i];
        const matchingLabour = laboursData?.find((l) => l.id === originalInput.labourId);
        return {
          ...originalInput,
          ...res,
          project: { name: selectedProject.name },
          labour: matchingLabour
            ? {
                name: matchingLabour.name,
                paymentPerDay: Number(matchingLabour.paymentPerDay),
                phonenumber: matchingLabour.phonenumber,
              }
            : undefined,
        };
      });

      setAttendanceList((prev) => [...formattedResults, ...prev]);
      toast({
        title: "Attendance copied",
        description: `Successfully copied ${formattedResults.length} labourers' attendance.`,
      });
    } catch (err: any) {
      toast({
        title: "Copy operation failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  // Filter projects local list
  const filteredProjects = useMemo(() => {
    const term = projectSearch.toLowerCase().trim();
    if (!term) return projectsList.slice(0, 10);
    return projectsList.filter((p) => p.name?.toLowerCase().includes(term));
  }, [projectsList, projectSearch]);

  // Filter labours local list
  const filteredLabours = useMemo(() => {
    const list = Array.isArray(laboursData) ? laboursData : [];
    const term = labourSearch.toLowerCase().trim();
    if (!term) return list.slice(0, 8);
    return list.filter((l) => l.name?.toLowerCase().includes(term));
  }, [laboursData, labourSearch]);

  // Apply UI Filters for Listings
  const filteredAttendance = useMemo(() => {
    return attendanceList.filter((a) => {
      // Labourer name search filter
      if (filterSearch.trim()) {
        const term = filterSearch.toLowerCase().trim();
        if (!a.labour?.name?.toLowerCase().includes(term)) return false;
      }
      // Project filter
      if (filterProjectId && a.projectId !== filterProjectId) return false;
      // Date filter
      if (filterDate) {
        const start = new Date(filterDate);
        start.setHours(0,0,0,0);
        const end = new Date(filterDate);
        end.setHours(23,59,59,999);
        const aDate = new Date(a.date);
        if (aDate < start || aDate > end) return false;
      }
      return true;
    });
  }, [attendanceList, filterSearch, filterDate, filterProjectId]);

  // Group attendance records by Date + Project
  const groupedAttendance = useMemo(() => {
    const groups: Record<string, { date: string; projectId: string; projectName: string; records: LabourAttendance[] }> = {};
    
    filteredAttendance.forEach((a) => {
      const parsedDate = new Date(a.date);
      if (isNaN(parsedDate.getTime())) return;
      const dStr = parsedDate.toISOString().split("T")[0];
      const groupKey = `${dStr}_${a.projectId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          date: dStr,
          projectId: a.projectId,
          projectName: a.project?.name || "Unknown Project",
          records: [],
        };
      }
      groups[groupKey].records.push(a);
    });

    // Convert to sorted array descending based on date
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredAttendance]);

  // Split out "Today's Live" components
  const todayDateStr = new Date().toISOString().split("T")[0];
  
  const { todaysGroups, historyGroups } = useMemo(() => {
    const todays: typeof groupedAttendance = [];
    const history: typeof groupedAttendance = [];
    groupedAttendance.forEach((g) => {
      if (g.date === todayDateStr) {
        todays.push(g);
      } else {
        history.push(g);
      }
    });
    return { todaysGroups: todays, historyGroups: history };
  }, [groupedAttendance, todayDateStr]);

  return (
    <div className="space-y-8 animate-fade-in p-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display flex items-center gap-2.5">
          <ClipboardCheck className="h-8 w-8 text-primary shrink-0 animate-pulse" />
          Labour Attendance Ledger
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Register daily site attendance checklists, copy rosters from past dates, and inspect work crew histories.
        </p>
      </div>

      {/* Main Form Entry Card */}
      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl overflow-visible">
        <CardHeader className="p-6 border-b border-slate-100 dark:border-zinc-900 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Calendar className="h-4 w-4 text-primary" />
            Mark Today's Attendance
          </CardTitle>
          <CardDescription className="text-xs">
            Mark individual workers as present or replicate from a past date.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 overflow-visible">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start overflow-visible">
            {/* Left form entry columns */}
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-visible">
              {/* Date & Site selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Attendance Date
                </label>
                <Input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                />
              </div>

              {/* Site Selection Input Box */}
              <div ref={projectRef} className="space-y-1 relative overflow-visible">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Select Project Site *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 pr-8"
                    placeholder="Type project name... (Enter to search server)"
                    value={projectSearch}
                    onFocus={() => setProjectOpen(true)}
                    onChange={(e) => {
                      setProjectSearch(e.target.value);
                      setProjectOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchProjectsFromServer(projectSearch);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setProjectOpen(!projectOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {projectOpen && (
                  <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    {projectSearching && (
                      <div className="px-4 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Searching server...
                      </div>
                    )}
                    {filteredProjects.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors"
                        onMouseDown={() => {
                          setSelectedProject(p);
                          setProjectSearch(p.name);
                          setProjectOpen(false);
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                    {!projectSearching && filteredProjects.length === 0 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground">
                        No matches. Press Enter to search server.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Add Labour Dropdown Input Box */}
              <div ref={labourRef} className="space-y-1 md:col-span-2 relative overflow-visible">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Add Present Labour *
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 pr-8"
                    placeholder="Search and select labour name..."
                    value={labourSearch}
                    disabled={!selectedProject}
                    onFocus={() => setLabourOpen(true)}
                    onChange={(e) => {
                      setLabourSearch(e.target.value);
                      setLabourOpen(true);
                    }}
                  />
                </div>

                {labourOpen && selectedProject && (
                  <div className="absolute z-[998] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                    {filteredLabours.map((l) => (
                      <div
                        key={l.id}
                        className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between"
                        onMouseDown={() => handleQueueLabour(l)}
                      >
                        <span>{l.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono font-bold">
                          ₹{l.paymentPerDay}/day
                        </span>
                      </div>
                    ))}
                    {filteredLabours.length === 0 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground italic">
                        No matches found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Queued Labours List and Submit Button */}
              {tempSelectedLabours.length > 0 && (
                <div className="md:col-span-2 space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                      Ready to Add ({tempSelectedLabours.length})
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveAttendance}
                      disabled={submittingAttendance}
                      className="font-bold text-xs shadow-md"
                    >
                      {submittingAttendance ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          Marking...
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Mark Attendance
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tempSelectedLabours.map((l) => (
                      <Badge
                        key={l.id}
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 flex items-center gap-1.5 rounded-full border border-slate-300/60 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-semibold"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{l.name}</span>
                        <span className="text-[10px] text-muted-foreground font-bold">
                          (₹{l.paymentPerDay})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(l.id)}
                          className="hover:text-destructive text-muted-foreground p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-805 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Copy roster columns */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/50 dark:border-zinc-800/50 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block">
                  Copy Names From Date
                </label>
                <Input
                  type="date"
                  value={copyFromDate}
                  onChange={(e) => setCopyFromDate(e.target.value)}
                  disabled={!selectedProject}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full font-bold text-xs bg-white hover:bg-slate-100 h-9"
                onClick={handleCopyNames}
                disabled={!selectedProject || !copyFromDate}
              >
                <Copy className="h-4 w-4 mr-1.5" />
                Copy Attendance List
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Filter Cards */}
      <Card className="border border-slate-200/60 dark:border-zinc-800/60 shadow-sm rounded-xl">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Search className="h-3 w-3" />
              Search Labour
            </span>
            <Input
              placeholder="Search present workers by name..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>

          <div className="w-full md:w-56 space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Calendar className="h-3 w-3" />
              Filter by Date
            </span>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div className="w-full md:w-64 space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
              <Building className="h-3 w-3" />
              Filter by Site
            </span>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All Project Sites</option>
              {projectsData?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setFilterSearch("");
              setFilterDate("");
              setFilterProjectId("");
            }}
            className="text-xs font-bold h-10 px-4 hover:bg-slate-100"
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Grouped Attendance Cards lists */}
      <div className="space-y-6">
        {loadingAttendance ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-zinc-950/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">
              Fetching attendance mappings ledger...
            </p>
          </div>
        ) : (
          <>
            {/* TODAY'S LIVE ATTENDANCE GROUP */}
            {todaysGroups.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold tracking-widest text-primary uppercase flex items-center gap-1">
                  <span className="relative flex h-2 w-2 mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Today's Active Sites
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {todaysGroups.map((g) => (
                    <Card
                      key={`${g.date}_${g.projectId}`}
                      className="border border-slate-200/80 hover:border-slate-300 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                              {g.projectName}
                            </h4>
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                              {formatDate(g.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/25 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                            {g.records.length} Present
                          </Badge>
                        </div>

                        <div className="p-5 pt-4 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {g.records.map((r) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="pl-3 pr-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-full flex items-center gap-1.5 select-none"
                              >
                                <span className="text-slate-700 dark:text-slate-300">
                                  {r.labour?.name}{" "}
                                  <span className="text-[10px] opacity-75 font-mono">
                                    (₹{r.labour?.paymentPerDay})
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleDeleteAttendance(r.id, r.labour?.name || "Labourer")}
                                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* PAST HISTORY ATTENDANCE GROUPS */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-extrabold tracking-widest text-slate-400 dark:text-zinc-600 uppercase flex items-center gap-1 select-none">
                <Users className="h-3.5 w-3.5" />
                Attendance History Logs
              </h3>

              {historyGroups.length === 0 && todaysGroups.length === 0 ? (
                <div className="p-14 text-center rounded-2xl bg-white/40 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center space-y-4">
                  <ClipboardCheck className="h-12 w-12 text-slate-300 dark:text-zinc-700" />
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-base">
                      No Attendance Logs Found
                    </h4>
                    <p className="text-sm text-slate-500 max-w-sm">
                      Check your filtration settings or add today's workers list to compile active site checkbooks.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {historyGroups.map((g) => (
                    <Card
                      key={`${g.date}_${g.projectId}`}
                      className="border border-slate-200/50 hover:border-slate-300 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="p-5 pb-3 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                              {g.projectName}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {formatDate(g.date)}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-[10px] px-2.5 py-0.5 rounded-full">
                            {g.records.length} Present
                          </Badge>
                        </div>

                        <div className="p-5 pt-4 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {g.records.map((r) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="pl-3 pr-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 border border-slate-200/40 rounded-full flex items-center gap-1.5 select-none"
                              >
                                <span className="text-slate-700 dark:text-slate-300">
                                  {r.labour?.name}{" "}
                                  <span className="text-[10px] opacity-75 font-mono">
                                    (₹{r.labour?.paymentPerDay})
                                  </span>
                                </span>
                                <button
                                  onClick={() => handleDeleteAttendance(r.id, r.labour?.name || "Labourer")}
                                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
