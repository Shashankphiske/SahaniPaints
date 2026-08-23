import { useState, useMemo, useRef } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import type { Labour, Project, LabourAttendance } from "../../types/master";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
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
  Activity
} from "lucide-react";

export default function LabourDailyLogPage() {
  // Local state for selected date
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  // State for search query & status filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");

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
      if (att.labourId) {
        map.set(att.labourId, att);
      }
    });
    return map;
  }, [allAttendance]);

  // Group present labours by project
  const siteAllocations = useMemo(() => {
    const groups: Record<string, { project: Project | null; attendants: LabourAttendance[] }> = {};
    
    allAttendance.forEach((att) => {
      const pId = att.projectId;
      if (!groups[pId]) {
        groups[pId] = {
          project: projectMap.get(pId) || null,
          attendants: []
        };
      }
      groups[pId].attendants.push(att);
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.project?.name || "";
      const nameB = b.project?.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [allAttendance, projectMap]);

  // Process status for all labours list
  const laboursStatusList = useMemo(() => {
    return allLabours.map((labour) => {
      const attendance = presentMap.get(labour.id);
      const isPresent = !!attendance;
      const project = attendance ? projectMap.get(attendance.projectId) : null;
      
      return {
        labour,
        isPresent,
        attendance,
        project
      };
    });
  }, [allLabours, presentMap, projectMap]);

  // Filtered status list for searching & filtering
  const filteredStatusList = useMemo(() => {
    return laboursStatusList.filter((item) => {
      const matchesSearch = item.labour.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.labour.phonenumber || "").includes(searchQuery);

      const matchesStatus = statusFilter === "ALL" ||
        (statusFilter === "PRESENT" && item.isPresent) ||
        (statusFilter === "ABSENT" && !item.isPresent);

      return matchesSearch && matchesStatus;
    });
  }, [laboursStatusList, searchQuery, statusFilter]);

  // Summary counts
  const totalCount = allLabours.length;
  const presentCount = presentMap.size;
  const absentCount = Math.max(0, totalCount - presentCount);
  const activeSitesCount = siteAllocations.length;

  const isLoading = laboursLoading || projectsLoading || attendanceLoading;

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
            Track daily attendance, present/absent statuses, and site allocations.
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
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={handleOpenPicker}
              className="pl-9 pr-3 h-9 text-sm w-48 font-semibold shadow-sm focus:ring-1 focus:ring-primary border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 cursor-pointer hide-native-picker"
            />
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 flex items-center justify-between border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Workforce</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-200">{totalCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900 text-slate-500">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Present Today</p>
            <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-200">{presentCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-450">
            <UserCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-rose-100 dark:border-rose-950 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Absent Today</p>
            <h3 className="text-xl font-bold text-rose-950 dark:text-rose-200">{absentCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-450">
            <UserX className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-blue-100 dark:border-blue-950 bg-blue-50/20 dark:bg-blue-950/10 shadow-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">Active Sites</p>
            <h3 className="text-xl font-bold text-blue-950 dark:text-blue-200">{activeSitesCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-450">
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
                <span>No active site allocations recorded for {new Date(selectedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</span>
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
                        <div key={att.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/50 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900">
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{att.labour?.name}</p>
                            {att.labour?.phonenumber && (
                              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{att.labour.phonenumber}</p>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge className="text-[9px] font-bold px-1.5 py-0 uppercase tracking-tight bg-blue-100 text-blue-800 border-blue-200/50 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                              {att.workDayType === "BOTH" ? "Both (Day & Night)" : att.workDayType}
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
                filteredStatusList.map(({ labour, isPresent, project, attendance }) => (
                  <div
                    key={labour.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isPresent
                        ? "bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                        : "bg-slate-50/40 dark:bg-zinc-900/10 border-slate-100 dark:border-zinc-900 opacity-70"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">{labour.name}</p>
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
    </div>
  );
}
