import { useState, useEffect, useMemo } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Search, ClipboardList, Loader2, PackagePlus } from "lucide-react";
import type { LowMaterial, Project } from "@/types/master";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

interface MaterialItemRow {
  id: string;
  selectedProductId: string;
  materialName: string;
  productFilter: string;
  quantity: string;
}

export default function MaterialRequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: requestsRaw, isLoading, create, update, remove } = useMasterData<LowMaterial>("low-materials");
  const projectsData = useMasterData<Project>("projects");

  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [requestDate, setRequestDate] = useState(() => getTodayString());
  const [searchQuery, setSearchQuery] = useState("");

  // Multi-material item rows
  const [items, setItems] = useState<MaterialItemRow[]>([
    { id: "1", selectedProductId: "", materialName: "", productFilter: "", quantity: "" },
  ]);

  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  const fetchFullProjectDetails = async (projectId: string) => {
    setFetchingProject(true);
    try {
      const full = await apiRequest.execute<Project>(`/projects/${projectId}`);
      setFullSelectedProject(full);
    } catch (err: any) {
      console.error("MaterialRequestsPage: Error fetching project details:", err);
      toast({
        title: "Error fetching project details",
        description: err.message || "Failed to load project details.",
        variant: "destructive",
      });
    } finally {
      setFetchingProject(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchFullProjectDetails(selectedProjectId);
    } else {
      setFullSelectedProject(null);
    }
  }, [selectedProjectId]);

  const requests = useMemo(() => (Array.isArray(requestsRaw) ? requestsRaw : []), [requestsRaw]);
  const projectsList = useMemo(() => (Array.isArray(projectsData.data) ? projectsData.data : []), [projectsData.data]);

  // Project options filtered by typed query
  const filteredProjectOptions = useMemo(
    () =>
      projectsList
        .filter((p) => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
        .slice(0, 10)
        .map((p) => ({ id: p.id, label: p.name })),
    [projectsList, projectFilter]
  );

  // Helper to get filtered catalog products for a specific row
  const getProductOptionsForRow = (filterQuery: string) => {
    const projectProducts = fullSelectedProject?.projectProducts?.map((pp: any) => pp.product).filter(Boolean) || [];
    return projectProducts
      .filter((p: any) => !filterQuery || p.name.toLowerCase().includes(filterQuery.toLowerCase()))
      .map((p: any) => ({ id: p.id, label: p.name }));
  };

  // Actions for item rows
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString().slice(2, 5), selectedProductId: "", materialName: "", productFilter: "", quantity: "" },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length <= 1) {
      toast({ title: "At least one item required", description: "You cannot remove all material rows.", variant: "destructive" });
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemRow = (id: string, updates: Partial<MaterialItemRow>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Hide requests that are both approved AND delivered on the main page
      if (r.approved && r.delivered) return false;

      const projName = r.project?.name || "";
      const matName = r.material || "";
      return (
        projName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        matName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [requests, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: "Validation Error", description: "Please select a site/project.", variant: "destructive" });
      return;
    }

    const validItems = items.filter((item) => item.materialName.trim() && item.quantity.trim());

    if (validItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please specify at least one material and quantity.",
        variant: "destructive",
      });
      return;
    }

    // Check if any row has incomplete data
    const incompleteItem = items.find(
      (item) => (item.materialName.trim() && !item.quantity.trim()) || (!item.materialName.trim() && item.quantity.trim())
    );
    if (incompleteItem) {
      toast({
        title: "Validation Error",
        description: "Please fill in both material name and quantity for all material rows.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const dateISO = new Date(requestDate).toISOString();
      
      const finalMaterialString =
        validItems.length === 1
          ? validItems[0].materialName.trim()
          : validItems.map((item, i) => `${i + 1}. ${item.materialName.trim()}`).join("\n");

      const finalQuantityString =
        validItems.length === 1
          ? validItems[0].quantity.trim()
          : validItems.map((item, i) => `${i + 1}. ${item.quantity.trim()}`).join("\n");

      // Create a SINGLE record containing all requested materials as a package
      await create({
        projectId: selectedProjectId,
        material: finalMaterialString,
        quantity: finalQuantityString,
        date: dateISO,
        approved: false,
        delivered: false,
      } as any);

      toast({
        title: "Material Request Submitted",
        description: `Successfully created material request package with ${validItems.length} item${validItems.length > 1 ? "s" : ""}.`,
      });

      setIsOpen(false);
      // Reset Form
      setSelectedProjectId("");
      setProjectDisplay("");
      setProjectFilter("");
      setItems([{ id: "1", selectedProductId: "", materialName: "", productFilter: "", quantity: "" }]);
      setRequestDate(getTodayString());
    } catch (err: any) {
      toast({ title: "Error creating requests", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { approved: true } as any,
    });
    toast({ title: "Request Approved", description: "Office approval recorded." });
  };

  const handleDeliver = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { delivered: true } as any,
    });
    toast({ title: "Request Delivered", description: "Material marked as delivered." });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Material Requests
          </h2>
          <p className="text-xs text-muted-foreground">Manage and track site material requests, approvals, and deliveries.</p>
        </div>

        {/* Add Request Button Trigger */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold flex items-center gap-1.5 shadow-sm">
              <Plus className="h-4.5 w-4.5" />
              Add Requests
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 sm:p-5 border-b bg-slate-50/50 dark:bg-zinc-900/50">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-primary" />
                <span>New Material Request</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Request single or multiple materials for a project site.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {/* Site & Date Selection Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 dark:bg-zinc-900/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Site / Project *</label>
                  <SearchableSelect
                    value={selectedProjectId}
                    displayValue={projectDisplay}
                    options={filteredProjectOptions}
                    placeholder="Select site"
                    inputHeight="h-10"
                    onSearchChange={(q) => setProjectFilter(q)}
                    onSelect={(id, label) => {
                      setSelectedProjectId(id);
                      setProjectDisplay(label);
                      setProjectFilter("");
                    }}
                    onClear={() => {
                      setSelectedProjectId("");
                      setProjectDisplay("");
                      setProjectFilter("");
                    }}
                    onEnter={(val) => projectsData.forceServerSearch(val)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Request Date *</label>
                  <Input
                    type="date"
                    max={getTodayString()}
                    value={requestDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const today = getTodayString();
                      if (val > today) setRequestDate(today);
                      else setRequestDate(val);
                    }}
                    className="h-10 text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Multi-Material Items Section */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Materials Required ({items.length})
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItemRow}
                    className="h-8 text-[11px] font-bold gap-1 text-primary hover:text-primary/80 border-primary/20 hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Another Material</span>
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 relative shadow-2xs group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Material #{index + 1}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemRow(item.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove material row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                        <div className="sm:col-span-3 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Material Name *
                          </label>
                          <SearchableSelect
                            value={item.selectedProductId}
                            displayValue={item.materialName}
                            options={getProductOptionsForRow(item.productFilter)}
                            placeholder={fetchingProject ? "Loading project products..." : "Search product or type material name"}
                            inputHeight="h-10"
                            onSearchChange={(q) => {
                              updateItemRow(item.id, {
                                productFilter: q,
                                materialName: q ? q : item.materialName,
                                selectedProductId: q ? "" : item.selectedProductId,
                              });
                            }}
                            onSelect={(id, label) => {
                              updateItemRow(item.id, {
                                selectedProductId: id,
                                materialName: label,
                                productFilter: "",
                              });
                            }}
                            onClear={() => {
                              updateItemRow(item.id, {
                                selectedProductId: "",
                                materialName: "",
                                productFilter: "",
                              });
                            }}
                            onEnter={(val) => {
                              updateItemRow(item.id, { materialName: val });
                            }}
                            required
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Quantity *
                          </label>
                          <Input
                            placeholder="e.g. 50 Ltrs / 4 Ltr bucket"
                            value={item.quantity}
                            onChange={(e) => updateItemRow(item.id, { quantity: e.target.value })}
                            className="h-10 text-sm font-semibold"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  className="h-9 text-xs font-bold gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add More</span>
                </Button>

                <Button type="submit" disabled={submitting} className="font-bold h-10 px-5">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit {items.length > 1 ? `${items.length} Requests` : "Request"}</span>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and List */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden p-4 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by site or material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Requests Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Site / Project</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Approved by Office</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <span className="text-xs text-muted-foreground mt-2 block">Loading requests...</span>
                  </TableCell>
                </TableRow>
              ) : filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs italic">
                    No material requests found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-xs">{formatDate(req.date)}</TableCell>
                    <TableCell className="font-bold text-xs">{req.project?.name || "—"}</TableCell>
                    <TableCell className="font-semibold text-xs text-indigo-650 dark:text-indigo-400 whitespace-pre-line leading-relaxed">{req.material}</TableCell>
                    <TableCell className="font-medium text-xs whitespace-pre-line leading-relaxed">{req.quantity}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            req.approved
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-200"
                              : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-200"
                          }`}
                        >
                          {req.approved ? "Approved" : "Pending"}
                        </Badge>
                        {isAdmin && !req.approved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleApprove(req)}
                            className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold px-2"
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            req.delivered
                              ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450 border-blue-200"
                              : "bg-slate-50 dark:bg-zinc-900 text-slate-500 border-slate-200"
                          }`}
                        >
                          {req.delivered ? "Delivered" : "Pending"}
                        </Badge>
                        {isAdmin && !req.delivered && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeliver(req)}
                            className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold px-2"
                          >
                            Mark Delivered
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this request?")) {
                            remove(req.id);
                            toast({ title: "Request Removed", description: "Material request deleted." });
                          }
                        }}
                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
