import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../lib/api";
import { SearchableSelect } from "../ui/SearchableSelect";
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
  ArrowLeft,
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

interface QueuedLabour {
  labour: Labour;
  shift: "DAY" | "NIGHT" | "BOTH";
}

export default function LabourAttendancePage() {
  const { user } = useAuth();
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
  const [tempSelectedLabours, setTempSelectedLabours] = useState<QueuedLabour[]>([]);
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
  const [filterProjectDisplay, setFilterProjectDisplay] = useState("");

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

  // Helper: Get occupied shifts for a labour on a specific date across all site attendance records
  const getOccupiedShifts = (labourId: string, dateStr: string) => {
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    let dayOccupied = false;
    let nightOccupied = false;
    let daySiteName = "";
    let nightSiteName = "";

    attendanceList.forEach((a) => {
      if (a.labourId !== labourId) return;
      const aDate = new Date(a.date);
      if (isNaN(aDate.getTime()) || aDate < startOfDay || aDate > endOfDay) return;

      const siteName = a.project?.name || "another site";
      const shiftType = a.workDayType || (Number(a.workDayValue) > 1.0 ? "BOTH" : "DAY");

      if (shiftType === "DAY") {
        dayOccupied = true;
        daySiteName = siteName;
      } else if (shiftType === "NIGHT") {
        nightOccupied = true;
        nightSiteName = siteName;
      } else if (shiftType === "BOTH" || shiftType === "DAY_AND_NIGHT") {
        dayOccupied = true;
        nightOccupied = true;
        daySiteName = siteName;
        nightSiteName = siteName;
      }
    });

    return { dayOccupied, nightOccupied, daySiteName, nightSiteName };
  };

  // Queue Labour locally before saving with shift conflict validation
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
    if (tempSelectedLabours.some((item) => item.labour.id === labour.id)) {
      toast({
        title: "Labourer already queued",
        description: `"${labour.name}" is already in the list to be added.`,
        variant: "destructive",
      });
      setLabourOpen(false);
      return;
    }

    const { dayOccupied, nightOccupied, daySiteName, nightSiteName } = getOccupiedShifts(labour.id, currentDate);

    // If both DAY and NIGHT are occupied across sites
    if (dayOccupied && nightOccupied) {
      const siteInfo = daySiteName === nightSiteName ? `at ${daySiteName}` : `at ${daySiteName} (Day) & ${nightSiteName} (Night)`;
      toast({
        title: "Labourer fully occupied",
        description: `"${labour.name}" is already marked for both Day and Night shifts ${siteInfo} on this date.`,
        variant: "destructive",
      });
      setLabourOpen(false);
      return;
    }

    // Determine default shift based on availability
    let initialShift: "DAY" | "NIGHT" | "BOTH" = "DAY";
    if (dayOccupied) {
      initialShift = "NIGHT";
      toast({
        title: "Assigned to Night Shift",
        description: `"${labour.name}" is already working Day shift at ${daySiteName}. Automatically assigned to Night shift.`,
      });
    } else if (nightOccupied) {
      initialShift = "DAY";
      toast({
        title: "Assigned to Day Shift",
        description: `"${labour.name}" is already working Night shift at ${nightSiteName}. Automatically assigned to Day shift.`,
      });
    }

    setTempSelectedLabours((prev) => [...prev, { labour, shift: initialShift }]);
    setLabourOpen(false);
    setLabourSearch("");
  };

  const handleRemoveFromQueue = (labourId: string) => {
    setTempSelectedLabours((prev) => prev.filter((item) => item.labour.id !== labourId));
  };

  const handleUpdateQueueShift = (labourId: string, requestedShift: "DAY" | "NIGHT" | "BOTH") => {
    const targetItem = tempSelectedLabours.find((item) => item.labour.id === labourId);
    if (!targetItem) return;

    const { dayOccupied, nightOccupied, daySiteName, nightSiteName } = getOccupiedShifts(labourId, currentDate);

    if ((requestedShift === "DAY" || requestedShift === "BOTH") && dayOccupied) {
      toast({
        title: "Day Shift Conflict",
        description: `"${targetItem.labour.name}" is already working Day shift at ${daySiteName} on this date. You can only assign Night shift.`,
        variant: "destructive",
      });
      return;
    }

    if ((requestedShift === "NIGHT" || requestedShift === "BOTH") && nightOccupied) {
      toast({
        title: "Night Shift Conflict",
        description: `"${targetItem.labour.name}" is already working Night shift at ${nightSiteName} on this date. You can only assign Day shift.`,
        variant: "destructive",
      });
      return;
    }

    setTempSelectedLabours((prev) =>
      prev.map((item) => (item.labour.id === labourId ? { ...item, shift: requestedShift } : item))
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedProject || tempSelectedLabours.length === 0) return;

    setSubmittingAttendance(true);
    let successCount = 0;
    const newRecords: LabourAttendance[] = [];

    const shiftValues = {
      DAY: 1.0,
      NIGHT: 0.5,
      BOTH: 1.5,
    };

    for (const item of tempSelectedLabours) {
      try {
        const payload = {
          date: new Date(currentDate).toISOString(),
          projectId: selectedProject.id,
          labourId: item.labour.id,
          workDayType: item.shift,
          workDayValue: shiftValues[item.shift],
          markedById: user?.id || null,
        };

        const result = await apiRequest.create<LabourAttendance>("labour-attendance", payload as any);

        const fullRecord: LabourAttendance = {
          ...payload,
          ...result,
          project: { name: selectedProject.name },
          labour: {
            name: item.labour.name,
            paymentPerDay: Number(item.labour.paymentPerDay),
            phonenumber: item.labour.phonenumber,
          },
          markedBy: user ? { id: user.id, username: user.username || "" } : null,
        };
        newRecords.push(fullRecord);
        successCount++;
      } catch (err: any) {
        toast({
          title: `Failed to mark ${item.labour.name}`,
          description: err.message || "An error occurred.",
          variant: "destructive",
        });
      }
    }

    if (successCount > 0) {
      setAttendanceList((prev) => {
        const filteredPrev = prev.filter((r) => !newRecords.some((nr) => nr.id === r.id));
        return [...newRecords, ...filteredPrev];
      });
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

    const labourersToCopy = pastRecords.filter((r) => {
      if (targetLabourIds.has(r.labourId)) return false;
      const { dayOccupied, nightOccupied } = getOccupiedShifts(r.labourId, currentDate);
      const shift = r.workDayType || "DAY";
      if (shift === "DAY" && dayOccupied) return false;
      if (shift === "NIGHT" && nightOccupied) return false;
      if ((shift === "BOTH" || shift === "DAY_AND_NIGHT") && (dayOccupied || nightOccupied)) return false;
      return true;
    });

    if (labourersToCopy.length === 0) {
      toast({
        title: "No eligible labourers to copy",
        description: "All labourers from that date are either already marked on this site or occupied on another site for that shift.",
      });
      return;
    }

    try {
      const payload = labourersToCopy.map((r) => ({
        date: new Date(currentDate).toISOString(),
        projectId: selectedProject.id,
        labourId: r.labourId,
        workDayType: r.workDayType || "DAY",
        workDayValue: Number(r.workDayValue || 1.0),
        markedById: user?.id || null,
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
          markedBy: user ? { id: user.id, username: user.username || "" } : null,
        };
      });

      setAttendanceList((prev) => {
        const filteredPrev = prev.filter((r) => !formattedResults.some((fr) => fr.id === r.id));
        return [...formattedResults, ...filteredPrev];
      });
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

  // Toggle cards state
  const [showAddCard, setShowAddCard] = useState(false);
  const [showFilterCard, setShowFilterCard] = useState(false);

  const [selectedDetailGroup, setSelectedDetailGroup] = useState<{
    date: string;
    projectId: string;
    projectName: string;
  } | null>(null);

  const handleOpenDetail = (g: { date: string; projectId: string; projectName: string }) => {
    setSelectedDetailGroup(g);
    setCurrentDate(g.date);
    const matchingProj = projectsList.find((p) => p.id === g.projectId) || ({ id: g.projectId, name: g.projectName } as Project);
    setSelectedProject(matchingProj);
    setProjectSearch(g.projectName);
  };

  const handleBackToLedger = () => {
    setSelectedDetailGroup(null);
    setSelectedProject(null);
    setProjectSearch("");
    setCurrentDate(new Date().toISOString().split("T")[0]);
    setTempSelectedLabours([]);
  };

  const activeDetailRecords = useMemo(() => {
    if (!selectedDetailGroup) return [];
    const start = new Date(selectedDetailGroup.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDetailGroup.date);
    end.setHours(23, 59, 59, 999);

    return attendanceList.filter((a) => {
      const d = new Date(a.date);
      return a.projectId === selectedDetailGroup.projectId && d >= start && d <= end;
    });
  }, [attendanceList, selectedDetailGroup]);

  return (
    <div className="space-y-8 animate-fade-in p-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Ledger List Mode */}
      {!selectedDetailGroup && (
        <div className="space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-800/60 pb-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display flex items-center gap-2.5">
              <ClipboardCheck className="h-8 w-8 text-primary shrink-0" />
              Labour Attendance Ledger
            </h1>

            <div className="flex items-center gap-2">
              <Button
                variant={showFilterCard ? "default" : "outline"}
                onClick={() => setShowFilterCard(!showFilterCard)}
                className="font-medium flex items-center gap-1.5 shadow-sm h-9"
              >
                <Filter className="h-4 w-4" />
                Filters
                {(filterSearch || filterDate || filterProjectId) ? (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full font-medium">
                    !
                  </span>
                ) : null}
              </Button>

              <Button
                variant={showAddCard ? "default" : "outline"}
                onClick={() => {
                  setShowAddCard(!showAddCard);
                  // Reset states when starting a new attendance marking flow
                  setSelectedProject(null);
                  setProjectSearch("");
                  setCurrentDate(new Date().toISOString().split("T")[0]);
                }}
                className="font-medium flex items-center gap-1.5 shadow-sm h-9"
              >
                <UserPlus className="h-4 w-4" />
                Mark New Attendance
              </Button>
            </div>
          </div>

          {/* New Attendance Entry Trigger Card */}
          {showAddCard && (
            <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-2xl p-6 max-w-xl mx-auto overflow-visible animate-in fade-in-50 slide-in-from-top-1 duration-150">
              <CardHeader className="p-0 pb-4 border-b border-slate-100 dark:border-zinc-900">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <Calendar className="h-4 w-4 text-primary" />
                  New Attendance sheet
                </CardTitle>
                <CardDescription>
                  Select a project site and date to start marking attendance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pt-4 space-y-4 overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-visible">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Attendance Date
                    </label>
                    <Input
                      type="date"
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <div ref={projectRef} className="space-y-1 relative overflow-visible">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Project Site *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9 pr-8 h-10"
                        placeholder="Type site name..."
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
                      <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-40 overflow-y-auto mt-1 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                        {projectSearching && (
                          <div className="px-4 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                            Searching...
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
                            No matches. Press Enter to search.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full font-bold shadow-md h-10 mt-2"
                  disabled={!selectedProject}
                  onClick={() => {
                    if (selectedProject) {
                      handleOpenDetail({
                        date: currentDate,
                        projectId: selectedProject.id,
                        projectName: selectedProject.name,
                      });
                      setShowAddCard(false);
                    }
                  }}
                >
                  Start Marking Attendance
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Global Filter Cards */}
          {showFilterCard && (
            <Card className="border border-slate-200/60 dark:border-zinc-800/60 shadow-sm rounded-xl">
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
                    <Search className="h-3 w-3" />
                    Search Labour
                  </span>
                  <Input
                    placeholder="Search present workers by name..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="w-full md:w-56 space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
                    <Calendar className="h-3 w-3" />
                    Filter by Date
                  </span>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="w-full md:w-64 space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 select-none">
                    <Building className="h-3 w-3" />
                    Filter by Site
                  </span>
                  <SearchableSelect
                    value={filterProjectId}
                    displayValue={filterProjectDisplay}
                    options={(projectsData ?? [])
                      .filter((p) => !filterProjectDisplay || p.name.toLowerCase().includes(filterProjectDisplay.toLowerCase()))
                      .slice(0, 10)
                      .map((p) => ({ id: p.id, label: p.name }))}
                    placeholder="All Project Sites"
                    allLabel="All Project Sites"
                    onSearchChange={setFilterProjectDisplay}
                    onSelect={(id, label) => { setFilterProjectId(id); setFilterProjectDisplay(id ? label : ""); }}
                    onClear={() => { setFilterProjectId(""); setFilterProjectDisplay(""); }}
                  />
                </div>

                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilterSearch("");
                    setFilterDate("");
                    setFilterProjectId("");
                    setFilterProjectDisplay("");
                  }}
                  className="text-xs font-bold h-10 px-4 hover:bg-slate-100"
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Grouped Attendance Table Ledger */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold tracking-widest text-slate-400 dark:text-zinc-650 uppercase flex items-center gap-1.5 select-none">
              <Users className="h-4 w-4" />
              Attendance Sheets Ledger
            </h3>

            {loadingAttendance ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-zinc-950/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-semibold text-slate-500 animate-pulse">
                  Fetching attendance mappings ledger...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-md">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Project Site</th>
                      <th className="px-6 py-4 text-center">Labours Present</th>
                      <th className="px-6 py-4 text-right">Daily Labor Cost</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-500 font-semibold">
                          <ClipboardCheck className="h-12 w-12 text-slate-300 dark:text-zinc-700 mx-auto mb-3 opacity-40" />
                          No Attendance Sheets Found
                          <p className="text-xs font-normal text-slate-400 mt-1">
                            Click "Mark New Attendance" to get started or adjust filter parameters.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      groupedAttendance.map((g) => {
                        const totalCost = g.records.reduce((sum, r) => sum + (Number(r.labour?.paymentPerDay || 0) * Number(r.workDayValue ?? 1.0)), 0);
                        return (
                          <tr
                            key={`${g.date}_${g.projectId}`}
                            onClick={() => handleOpenDetail(g)}
                            className="border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-900/10 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4 font-mono font-bold text-xs text-slate-500 dark:text-zinc-400">
                              {formatDate(g.date)}
                            </td>
                            <td className="px-6 py-4 font-extrabold text-slate-800 dark:text-slate-200">
                              {g.projectName}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="secondary" className="bg-slate-100 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 font-extrabold text-xs px-2.5 py-0.5 rounded-full border border-slate-200/20">
                                {g.records.length} Present
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-extrabold text-slate-900 dark:text-slate-100">
                              ₹{totalCost.toLocaleString("en-IN")}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(g);
                                }}
                                className="font-bold text-xs text-primary hover:text-primary hover:bg-primary/5 rounded-lg"
                              >
                                View & Mark
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed View Mode */}
      {selectedDetailGroup && (
        <div className="space-y-6">
          {/* Back Button and Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-800/60 pb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToLedger}
                className="h-9 w-9 p-0 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display">
                  {selectedDetailGroup.projectName}
                </h1>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Attendance Sheet for {formatDate(selectedDetailGroup.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold px-3 py-1 text-xs rounded-full">
                {activeDetailRecords.length} Workers Present
              </Badge>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 text-xs rounded-full">
                Wages: ₹{activeDetailRecords.reduce((sum, r) => sum + Number(r.labour?.paymentPerDay || 0) * Number(r.workDayValue ?? 1.0), 0).toLocaleString("en-IN")}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Mark Attendance & Copy */}
            <div className="lg:col-span-5 space-y-6">
              {/* Form Entry Card */}
              <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 rounded-2xl overflow-visible">
                <CardHeader className="p-5 border-b border-slate-100 dark:border-zinc-900 pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <UserPlus className="h-4 w-4 text-primary" />
                    Add Labour to Roster
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4 overflow-visible">
                  {/* Labour Search */}
                  <div ref={labourRef} className="space-y-1 relative overflow-visible">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Search Labourer Name *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9 pr-8 h-10"
                        placeholder="Search by name..."
                        value={labourSearch}
                        onFocus={() => setLabourOpen(true)}
                        onChange={(e) => {
                          setLabourSearch(e.target.value);
                          setLabourOpen(true);
                        }}
                      />
                    </div>

                    {labourOpen && (
                      <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-2 animate-in fade-in-50 slide-in-from-top-1 duration-150">
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
                    <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 animate-in fade-in-50 slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                          Queue ({tempSelectedLabours.length})
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
                              Saving...
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              Mark Present
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {tempSelectedLabours.map(({ labour: l, shift }) => {
                          const baseRate = Number(l.paymentPerDay || 0);
                          const multiplier = shift === "DAY" ? 1.0 : shift === "NIGHT" ? 0.5 : 1.5;
                          const calculatedWage = baseRate * multiplier;
                          const { dayOccupied, nightOccupied, daySiteName, nightSiteName } = getOccupiedShifts(l.id, currentDate);

                          return (
                            <div
                              key={l.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm"
                            >
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{l.name}</p>
                                <p className="text-[9px] text-slate-400 font-semibold">
                                  Base: ₹{baseRate} · Wage: <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{calculatedWage}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={shift}
                                  onChange={(e) => handleUpdateQueueShift(l.id, e.target.value as any)}
                                  className="h-8 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-zinc-350 focus:outline-none focus:ring-0"
                                >
                                  <option value="DAY" disabled={dayOccupied}>Day (1.0x)</option>
                                  <option value="NIGHT" disabled={nightOccupied}>Night (0.5x)</option>
                                  <option value="BOTH" disabled={dayOccupied || nightOccupied}>Both (1.5x)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromQueue(l.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Copy Roster Card */}
              <Card className="border border-slate-200/50 dark:border-zinc-800/50 shadow-sm bg-slate-50/40 dark:bg-zinc-900/10 rounded-2xl p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider block">
                    Copy Attendance List From Date
                  </label>
                  <Input
                    type="date"
                    value={copyFromDate}
                    onChange={(e) => setCopyFromDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-bold text-xs bg-white hover:bg-slate-100 h-9"
                  onClick={handleCopyNames}
                  disabled={!copyFromDate}
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy Attendance List
                </Button>
              </Card>
            </div>

            {/* Right Column: Present Laborers List */}
            <div className="lg:col-span-7">
              <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden">
                <CardHeader className="p-5 border-b border-slate-100 dark:border-zinc-900 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                    <Users className="h-4 w-4 text-emerald-500" />
                    Present Workers list ({activeDetailRecords.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {activeDetailRecords.length === 0 ? (
                    <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
                      <ClipboardCheck className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-semibold">No labourers marked present yet.</p>
                      <p className="text-xs opacity-70">Use the left panel to search and add labourers.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-900 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            <th className="px-5 py-3">Worker Name</th>
                            <th className="px-5 py-3 text-center">Shift</th>
                            <th className="px-5 py-3 text-right">Base / Daily Wage</th>
                            <th className="px-5 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDetailRecords.map((r) => {
                            const baseRate = Number(r.labour?.paymentPerDay || 0);
                            const val = Number(r.workDayValue ?? 1.0);
                            const wage = baseRate * val;
                            const shiftLabel = r.workDayType === "NIGHT" ? "Night" : r.workDayType === "BOTH" ? "Both" : "Day";
                            const shiftColor = r.workDayType === "NIGHT" ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100"
                              : r.workDayType === "BOTH" ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-100"
                              : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100";

                            return (
                              <tr key={r.id} className="border-b border-slate-100 dark:border-zinc-900 text-sm hover:bg-slate-50/50 dark:hover:bg-zinc-900/10">
                                <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">
                                  {r.labour?.name}
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${shiftColor}`}>
                                    {shiftLabel} ({val}x)
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                  <span className="text-xs text-slate-400 font-normal">₹{baseRate} / </span>
                                  <span className="text-emerald-600 dark:text-emerald-400">₹{wage}</span>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <button
                                    onClick={() => handleDeleteAttendance(r.id, r.labour?.name || "Labourer")}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
