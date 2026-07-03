import { useState, useEffect, useRef, useMemo } from "react";
import { useMasterData } from "../../hooks/use-master-data";
import { apiRequest } from "../../lib/api";
import type { Project, Area, Color, ProjectAreaColor } from "../../types/master";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { toast } from "../../hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  Paintbrush,
  Loader2,
  Layers,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Copy,
} from "lucide-react";

// Generate clean initials (e.g. "Living Room" -> "LR")
const getInitials = (name: string) => {
  if (!name) return "PR";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Return a tailored color scheme for project avatars based on name hash
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function SiteColorsPage() {
  const { data: projectsData, isLoading: loadingProjects } = useMasterData<Project>("projects");
  const { data: colorsData } = useMasterData<Color>("colors");
  const { data: globalAreasData } = useMasterData<Area>("areas");

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [mappings, setMappings] = useState<ProjectAreaColor[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // Search keyword for projects list sidebar filter
  const [projectSearch, setProjectSearch] = useState("");

  // Modal states for mapping colors
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [modalAreaSearch, setModalAreaSearch] = useState("");
  const [modalColorSearch, setModalColorSearch] = useState("");
  const [modalAreaOpen, setModalAreaOpen] = useState(false);
  const [modalColorOpen, setModalColorOpen] = useState(false);
  const modalAreaRef = useRef<HTMLDivElement>(null);
  const modalColorRef = useRef<HTMLDivElement>(null);
  const [creatingArea, setCreatingArea] = useState(false);

  // Modal states for duplicating mappings from another project
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateSourceProject, setDuplicateSourceProject] = useState<Project | null>(null);
  const [modalDupProjectSearch, setModalDupProjectSearch] = useState("");
  const [modalDupProjectOpen, setModalDupProjectOpen] = useState(false);
  const modalDupProjectRef = useRef<HTMLDivElement>(null);
  const [copyingMappings, setCopyingMappings] = useState(false);

  // Click outside utility for dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalAreaRef.current && !modalAreaRef.current.contains(e.target as Node)) {
        setModalAreaOpen(false);
      }
      if (modalColorRef.current && !modalColorRef.current.contains(e.target as Node)) {
        setModalColorOpen(false);
      }
      if (modalDupProjectRef.current && !modalDupProjectRef.current.contains(e.target as Node)) {
        setModalDupProjectOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch color mappings for the selected project
  const fetchProjectColorMappings = async (projectId: string) => {
    setLoadingMappings(true);
    try {
      const results = await apiRequest.fetchAll<ProjectAreaColor>("project-area-colors", {
        projectId,
      });
      setMappings(Array.isArray(results) ? results : []);
    } catch (err: any) {
      toast({
        title: "Failed to fetch mappings",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoadingMappings(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      fetchProjectColorMappings(selectedProject.id);
    } else {
      setMappings([]);
    }
  }, [selectedProject]);

  const openAddModal = () => {
    setSelectedArea(null);
    setSelectedColor(null);
    setModalAreaSearch("");
    setModalColorSearch("");
    setModalAreaOpen(false);
    setModalColorOpen(false);
    setIsAddModalOpen(true);
  };

  const openDuplicateModal = () => {
    setDuplicateSourceProject(null);
    setModalDupProjectSearch("");
    setModalDupProjectOpen(false);
    setIsDuplicateModalOpen(true);
  };

  // Filter global areas for dropdown selection inside modal
  const filteredGlobalAreas = useMemo(() => {
    const list = Array.isArray(globalAreasData) ? globalAreasData : [];
    const term = modalAreaSearch.toLowerCase().trim();
    if (!term) return list.slice(0, 10);
    return list.filter((a) => a.name?.toLowerCase().includes(term));
  }, [globalAreasData, modalAreaSearch]);

  // Create global area inline
  const handleCreateGlobalAreaInline = async (name: string) => {
    if (!name.trim()) return;
    setCreatingArea(true);
    try {
      const created = await apiRequest.create<Area>("areas", { name: name.trim() });
      setSelectedArea(created);
      setModalAreaSearch(created.name);
      setModalAreaOpen(false);
      toast({
        title: "Area created",
        description: `Created global area "${created.name}".`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to create area",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setCreatingArea(false);
    }
  };

  // Save color-area mapping to project
  const handleSaveMapping = async () => {
    if (!selectedProject) return;
    if (!selectedArea) {
      toast({
        title: "Area required",
        description: "Please select a workspace area.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedColor) {
      toast({
        title: "Color required",
        description: "Please select a paint color.",
        variant: "destructive",
      });
      return;
    }

    // Check duplicate
    const isDuplicate = mappings.some(
      (m) => m.areaId === selectedArea.id && m.colorId === selectedColor.id
    );
    if (isDuplicate) {
      toast({
        title: "Mapping already exists",
        description: `"${selectedColor.name}" is already assigned to "${selectedArea.name}".`,
        variant: "destructive",
      });
      return;
    }

    setCreatingArea(true);
    try {
      const payload = {
        projectId: selectedProject.id,
        areaId: selectedArea.id,
        colorId: selectedColor.id,
      };
      const result = await apiRequest.create<ProjectAreaColor>("project-area-colors", payload);

      const mappingWithColor: ProjectAreaColor = {
        ...result,
        projectId: selectedProject.id,
        areaId: selectedArea.id,
        colorId: selectedColor.id,
        area: selectedArea,
        color: selectedColor,
      };

      setMappings((prev) => [mappingWithColor, ...prev]);
      setIsAddModalOpen(false);
      toast({
        title: "Mapping created",
        description: `Successfully mapped "${selectedColor.name}" to "${selectedArea.name}".`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to map color",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setCreatingArea(false);
    }
  };

  // Duplicate color mappings from another project
  const handleDuplicateMappings = async () => {
    if (!selectedProject || !duplicateSourceProject) return;

    setCopyingMappings(true);
    try {
      // 1. Fetch source project color mappings
      const sourceMappings = await apiRequest.fetchAll<ProjectAreaColor>("project-area-colors", {
        projectId: duplicateSourceProject.id,
      });

      if (!Array.isArray(sourceMappings) || sourceMappings.length === 0) {
        toast({
          title: "No mappings found",
          description: `"${duplicateSourceProject.name}" has no color mappings configured.`,
          variant: "destructive",
        });
        return;
      }

      // 2. Filter out mappings that already exist in target project
      const existingKeySet = new Set(mappings.map((m) => `${m.areaId}_${m.colorId}`));
      const newMappingsToCopy = sourceMappings.filter(
        (sm) => !existingKeySet.has(`${sm.areaId}_${sm.colorId}`)
      );

      if (newMappingsToCopy.length === 0) {
        toast({
          title: "All mappings already exist",
          description: `All color mappings from "${duplicateSourceProject.name}" are already configured here.`,
        });
        setIsDuplicateModalOpen(false);
        return;
      }

      // 3. Create mappings in database
      const createdMappings: ProjectAreaColor[] = [];
      for (const sm of newMappingsToCopy) {
        if (!sm.area || !sm.color) continue;
        const payload = {
          projectId: selectedProject.id,
          areaId: sm.areaId,
          colorId: sm.colorId,
        };
        const result = await apiRequest.create<ProjectAreaColor>("project-area-colors", payload);
        createdMappings.push({
          ...result,
          projectId: selectedProject.id,
          areaId: sm.areaId,
          colorId: sm.colorId,
          area: sm.area,
          color: sm.color,
        });
      }

      setMappings((prev) => [...createdMappings, ...prev]);
      setIsDuplicateModalOpen(false);
      toast({
        title: "Mappings duplicated",
        description: `Successfully duplicated ${createdMappings.length} color mapping(s) from "${duplicateSourceProject.name}".`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to duplicate mappings",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setCopyingMappings(false);
    }
  };

  // Unassign Color from Area
  const handleUnassignColor = async (areaId: string, mappingId: string, colorName: string) => {
    if (!window.confirm("Are you sure you want to remove this color mapping?")) {
      return;
    }
    try {
      await apiRequest.delete("project-area-colors", mappingId);
      setMappings((prev) => prev.filter((m) => m.id !== mappingId));
      toast({
        title: "Color unassigned",
        description: `Removed "${colorName}" mapping.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to unassign color",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  // Filter projects by search query in list
  const filteredProjects = useMemo(() => {
    const list = Array.isArray(projectsData) ? projectsData : [];
    const term = projectSearch.toLowerCase().trim();
    if (!term) return list;
    return list.filter((p) => p.name?.toLowerCase().includes(term) || p.customer?.name?.toLowerCase().includes(term));
  }, [projectsData, projectSearch]);

  // Filter colors by search query
  const filteredColors = useMemo(() => {
    const list = Array.isArray(colorsData) ? colorsData : [];
    const term = modalColorSearch.toLowerCase().trim();
    if (!term) return list.slice(0, 8);
    return list.filter(
      (c) => c.name?.toLowerCase().includes(term) || c.shade?.toLowerCase().includes(term)
    );
  }, [colorsData, modalColorSearch]);

  // Filter project dropdown list to duplicate from
  const filteredDupSourceProjects = useMemo(() => {
    const list = Array.isArray(projectsData) ? projectsData : [];
    const term = modalDupProjectSearch.toLowerCase().trim();
    const otherProjects = list.filter((p) => p.id !== selectedProject?.id);
    if (!term) return otherProjects.slice(0, 10);
    return otherProjects.filter((p) => p.name?.toLowerCase().includes(term));
  }, [projectsData, modalDupProjectSearch, selectedProject]);

  if (!selectedProject) {
    return (
      <div className="space-y-8 animate-fade-in p-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-display flex items-center gap-2.5">
              <Paintbrush className="h-7 w-7 text-primary animate-pulse" />
              Site Colors Mapping
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Select an active construction project site to configure room color schemes and color code mappings.
            </p>
          </div>
        </div>

        {/* Search & Filter Header */}
        <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md rounded-2xl">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-10 rounded-xl border-slate-200 dark:border-zinc-850"
                placeholder="Search paint projects by name or customer..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-xs px-3.5 py-1.5 font-bold rounded-full select-none shadow-sm shrink-0">
              {filteredProjects.length} Active Sites
            </Badge>
          </CardContent>
        </Card>

        {/* Projects Grid List */}
        {loadingProjects ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">Loading active projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-20 text-center rounded-2xl bg-white/40 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center space-y-4">
            <FolderOpen className="h-12 w-12 text-slate-300 dark:text-zinc-700 animate-bounce" />
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 text-base tracking-tight">
                No Projects Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 max-w-sm">
                Try searching for a different keyword or add a new project in the projects master database page.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p) => (
              <Card
                key={p.id}
                className="group border border-slate-200/70 hover:border-indigo-500/50 dark:border-zinc-800/80 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-xl transition-all duration-300 bg-white/70 dark:bg-zinc-950/70 rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.01]"
                onClick={() => setSelectedProject(p)}
              >
                <CardContent className="p-6 flex flex-col justify-between h-44 bg-gradient-to-br from-white via-white to-slate-50/20 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm border shadow-inner ${getAvatarColor(p.name)}`}>
                        {getInitials(p.name)}
                      </div>
                      <div className="space-y-0.5 max-w-[160px] md:max-w-[200px] truncate">
                        <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                          {p.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold truncate">
                          Customer: {p.customer?.name || "—"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 dark:text-zinc-700 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-900/60 pt-4 mt-auto">
                    <span className="text-[10px] text-slate-400 font-bold font-mono">
                      Scheduled: {p.projectDate ? new Date(p.projectDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold py-0.5 px-2 border-slate-200 dark:border-zinc-800 text-slate-500">
                      Configure Mappings
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in p-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
      {/* Back to Projects link */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-bold text-slate-500 hover:text-primary flex items-center gap-1 bg-white/40 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800/50 rounded-xl px-3 py-1.5 shadow-sm"
          onClick={() => setSelectedProject(null)}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sites
        </Button>
      </div>

      {/* Selected Project Details Banner Card */}
      <Card className="border border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md rounded-2xl overflow-hidden animate-fade-in">
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-500/5 via-violet-500/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center font-black text-lg border shadow-sm ${getAvatarColor(selectedProject.name)}`}>
              {getInitials(selectedProject.name)}
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                Paint Site Details
              </p>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xl tracking-tight leading-tight">
                {selectedProject.name}
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Customer: {selectedProject.customer?.name || "—"} • Scheduled: {selectedProject.projectDate ? new Date(selectedProject.projectDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
          </div>
          <Badge className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 text-xs px-3.5 py-1.5 font-bold rounded-full select-none shadow-sm shrink-0">
            {mappings.length} Color Schemes Assigned
          </Badge>
        </div>
      </Card>

      {/* Mappings Table list card */}
      {loadingMappings ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white/40 dark:bg-zinc-950/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-semibold text-slate-500 animate-pulse">
            Fetching mapping assignments...
          </p>
        </div>
      ) : mappings.length === 0 ? (
        <Card className="border border-slate-200 dark:border-zinc-800/80 shadow-md rounded-2xl bg-white dark:bg-zinc-950">
          <CardHeader className="p-6 border-b border-slate-100 dark:border-zinc-900/60 flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Room Color Schemes
              </CardTitle>
              <CardDescription className="text-xs">
                Configure what color and shade allocations are applied to specific site rooms.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={openDuplicateModal} variant="outline" size="sm" className="font-bold text-xs rounded-xl">
                <Copy className="h-4 w-4 mr-1.5" /> Duplicate Mappings
              </Button>
              <Button onClick={openAddModal} size="sm" className="font-bold text-xs shadow-sm shadow-primary/20 rounded-xl">
                <Plus className="h-4 w-4 mr-1.5" /> Add Mapping
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-14 text-center flex flex-col items-center justify-center space-y-3.5">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-950 flex items-center justify-center">
              <Paintbrush className="h-5 w-5 text-slate-400 dark:text-zinc-650 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                No Colors Configured Yet
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm">
                Use the "Add Mapping" button to start linking paint colors to site coordinate areas.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-slate-200 dark:border-zinc-800/80 shadow-md rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 dark:border-zinc-900/60 flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Room Color Schemes
              </CardTitle>
              <CardDescription className="text-xs">
                List of assigned color/shade configurations mapped to site locations.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={openDuplicateModal} variant="outline" size="sm" className="font-bold text-xs rounded-xl">
                <Copy className="h-4 w-4 mr-1.5" /> Duplicate Mappings
              </Button>
              <Button onClick={openAddModal} size="sm" className="font-bold text-xs shadow-sm shadow-primary/20 rounded-xl">
                <Plus className="h-4 w-4 mr-1.5" /> Add Mapping
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-900/60 bg-slate-50/50 dark:bg-zinc-900/10">
                    <th className="p-4 pl-6 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Site Area</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Mapped Color & Shade</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900/60">
                  {mappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="p-4 pl-6 text-sm font-bold text-slate-800 dark:text-slate-100">
                        {m.area?.name}
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className="pl-3 pr-2.5 py-1 flex items-center w-fit gap-2 rounded-full border border-slate-200/50 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/30 font-semibold text-xs text-slate-800 dark:text-slate-300">
                          <span>{m.color?.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono font-bold border-l border-slate-200 dark:border-zinc-800 pl-2">({m.color?.shade})</span>
                        </Badge>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all rounded-lg"
                          onClick={() => handleUnassignColor(m.areaId, m.id, m.color?.name || "color")}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Mapping Dialog Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md overflow-visible rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold tracking-tight">Add Site Color Mapping</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-3 overflow-visible">
            {/* Select Area Dropdown */}
            <div ref={modalAreaRef} className="space-y-1.5 relative overflow-visible">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Select Area *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10 pr-10 rounded-xl border-slate-200 dark:border-zinc-800 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  placeholder="Type to search or select global area..."
                  value={modalAreaSearch}
                  onFocus={() => setModalAreaOpen(true)}
                  onChange={(e) => {
                    setModalAreaSearch(e.target.value);
                    setSelectedArea(null);
                    setModalAreaOpen(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setModalAreaOpen(!modalAreaOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {modalAreaOpen && (
                <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 animate-in fade-in-50 duration-100 font-medium">
                  {filteredGlobalAreas.map((area) => (
                    <div
                      key={area.id}
                      className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between text-slate-900 dark:text-slate-100"
                      onMouseDown={() => {
                        setSelectedArea(area);
                        setModalAreaSearch(area.name);
                        setModalAreaOpen(false);
                      }}
                    >
                      <span>{area.name}</span>
                    </div>
                  ))}
                  {modalAreaSearch.trim() && !filteredGlobalAreas.some(a => a.name.toLowerCase() === modalAreaSearch.toLowerCase().trim()) && (
                    <div
                      className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-xs text-primary font-bold flex items-center gap-1.5 border-t border-slate-100 dark:border-zinc-900"
                      onMouseDown={() => handleCreateGlobalAreaInline(modalAreaSearch)}
                    >
                      {creatingArea ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3.5 w-3.5 mr-1" />
                      )}
                      Create global area: "{modalAreaSearch}"
                    </div>
                  )}
                  {!modalAreaSearch.trim() && filteredGlobalAreas.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic font-semibold">
                      No unused areas found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Select Color Dropdown */}
            <div ref={modalColorRef} className="space-y-1.5 relative overflow-visible">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Select Paint Color *
              </label>
              <div className="relative">
                <Paintbrush className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10 pr-10 rounded-xl border-slate-200 dark:border-zinc-800 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  placeholder="Search colors by name or shade..."
                  value={modalColorSearch}
                  onFocus={() => setModalColorOpen(true)}
                  onChange={(e) => {
                    setModalColorSearch(e.target.value);
                    setSelectedColor(null);
                    setModalColorOpen(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setModalColorOpen(!modalColorOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {modalColorOpen && (
                <div className="absolute z-[998] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 animate-in fade-in-50 duration-100 font-medium">
                  {filteredColors.map((color) => (
                    <div
                      key={color.id}
                      className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900/80 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between text-slate-900 dark:text-slate-100"
                      onMouseDown={() => {
                        setSelectedColor(color);
                        setModalColorSearch(`${color.name} (${color.shade})`);
                        setModalColorOpen(false);
                      }}
                    >
                      <span>{color.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">({color.shade})</span>
                    </div>
                  ))}
                  {filteredColors.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic font-semibold">
                      No matching colors found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60">
              <Button type="button" variant="ghost" className="rounded-xl font-semibold px-5 py-2" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl font-semibold px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSaveMapping}
                disabled={creatingArea}
              >
                {creatingArea ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Adding...
                  </>
                ) : (
                  "Add Color Mapping"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Mappings Dialog Modal */}
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="max-w-md overflow-visible rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold tracking-tight">Duplicate Color Mappings</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-3 overflow-visible">
            <p className="text-xs text-muted-foreground">
              Select another project site to copy all its configured room area and color code mapping configurations.
            </p>

            {/* Select Project to Copy From */}
            <div ref={modalDupProjectRef} className="space-y-1.5 relative overflow-visible">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                Copy From Project *
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-10 pr-10 rounded-xl border-slate-200 dark:border-zinc-800 focus:ring-primary/20 focus:border-primary text-sm font-semibold"
                  placeholder="Select source project..."
                  value={modalDupProjectSearch}
                  onFocus={() => setModalDupProjectOpen(true)}
                  onChange={(e) => {
                    setModalDupProjectSearch(e.target.value);
                    setDuplicateSourceProject(null);
                    setModalDupProjectOpen(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setModalDupProjectOpen(!modalDupProjectOpen)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {modalDupProjectOpen && (
                <div className="absolute z-[999] bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full rounded-xl shadow-xl max-h-48 overflow-y-auto mt-1 animate-in fade-in-50 duration-100 font-medium">
                  {filteredDupSourceProjects.map((p) => (
                    <div
                      key={p.id}
                      className="px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer text-sm font-semibold transition-colors flex items-center justify-between text-slate-900 dark:text-slate-100"
                      onMouseDown={() => {
                        setDuplicateSourceProject(p);
                        setModalDupProjectSearch(p.name);
                        setModalDupProjectOpen(false);
                      }}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">({p.customer?.name || "—"})</span>
                    </div>
                  ))}
                  {filteredDupSourceProjects.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic font-semibold">
                      No other projects found.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60">
              <Button type="button" variant="ghost" className="rounded-xl font-semibold px-5 py-2" onClick={() => setIsDuplicateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-xl font-semibold px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleDuplicateMappings}
                disabled={copyingMappings}
              >
                {copyingMappings ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Duplicating...
                  </>
                ) : (
                  "Duplicate Mappings"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
