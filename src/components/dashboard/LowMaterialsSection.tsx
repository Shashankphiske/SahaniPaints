import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, CheckCircle, Package, Loader2, PackagePlus, Building2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/SearchableSelect";
import { useMasterData } from "../../hooks/use-master-data";
import { toast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/api";
import type { LowMaterial, Project, Product } from "../../types/master";

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

export function LowMaterialsSection() {
  const { data: materialsRaw, isLoading, create, update, remove } = useMasterData<LowMaterial>("low-materials");
  const projectsData = useMasterData<Project>("projects");
  const productsData = useMasterData<Product>("products");
  const projectsRaw = projectsData.data;
  const productsRaw = productsData.data;

  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [requestDate, setRequestDate] = useState(() => getTodayString());

  // Multi-material item rows
  const [items, setItems] = useState<MaterialItemRow[]>([
    { id: "1", selectedProductId: "", materialName: "", productFilter: "", quantity: "" },
  ]);

  const [fullSelectedProject, setFullSelectedProject] = useState<Project | null>(null);
  const [fetchingProject, setFetchingProject] = useState(false);

  // Only show pending (undelivered) alerts on the dashboard
  const materials = useMemo(
    () => (Array.isArray(materialsRaw) ? materialsRaw : []).filter((m) => !m.delivered),
    [materialsRaw]
  );
  const projectsList = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);
  const productsList = useMemo(() => (Array.isArray(productsRaw) ? productsRaw : []), [productsRaw]);

  // Fetch full project details when selecting a site to get allocated project products
  const fetchFullProjectDetails = async (projectId: string) => {
    setFetchingProject(true);
    try {
      const full = await apiRequest.execute<Project>(`/projects/${projectId}`);
      setFullSelectedProject(full);
    } catch (err: any) {
      console.error("LowMaterialsSection: Error fetching project details:", err);
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

  // Project options filtered by typed query
  const filteredProjectOptions = useMemo(
    () =>
      projectsList
        .filter((p) => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
        .slice(0, 15)
        .map((p) => ({ id: p.id, label: p.name })),
    [projectsList, projectFilter]
  );

  // Helper to get filtered catalog and project products for a specific row
  const getProductOptionsForRow = (filterQuery: string) => {
    const q = (filterQuery || "").toLowerCase().trim();
    const projectProducts = fullSelectedProject?.projectProducts?.map((pp: any) => pp.product).filter(Boolean) || [];

    if (projectProducts.length > 0) {
      const projFiltered = projectProducts
        .filter((p: any) => !q || p.name.toLowerCase().includes(q))
        .map((p: any) => ({ id: p.id, label: `${p.name} (Project)` }));

      const projIds = new Set(projectProducts.map((p: any) => p.id));
      const catalogFiltered = productsList
        .filter((p) => !projIds.has(p.id) && (!q || p.name.toLowerCase().includes(q)))
        .slice(0, 15)
        .map((p) => ({ id: p.id, label: p.name }));

      return [...projFiltered, ...catalogFiltered];
    }

    return productsList
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 15)
      .map((p) => ({ id: p.id, label: p.name }));
  };

  // Actions for item rows
  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString().slice(2, 5),
        selectedProductId: "",
        materialName: "",
        productFilter: "",
        quantity: "",
      },
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

  const resetForm = () => {
    setSelectedProjectId("");
    setProjectDisplay("");
    setProjectFilter("");
    setFullSelectedProject(null);
    setRequestDate(getTodayString());
    setItems([{ id: "1", selectedProductId: "", materialName: "", productFilter: "", quantity: "" }]);
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: "Validation Error", description: "Please select a project site.", variant: "destructive" });
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
        _projectName: projectDisplay,
        material: finalMaterialString,
        quantity: finalQuantityString,
        date: dateISO,
        approved: false,
        delivered: false,
      } as any);

      toast({
        title: "Alert Created",
        description: `Added low material alert with ${validItems.length} item${validItems.length > 1 ? "s" : ""}.`,
      });

      setIsOpen(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: "Failed to log material",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDelivered = (item: LowMaterial) => {
    try {
      update({
        id: item.id,
        data: { delivered: true } as any,
      });
      toast({ title: "Status Updated", description: "Material marked as delivered." });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message || "Could not update status.", variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to remove this low material alert?")) {
      remove(id);
      toast({ title: "Alert Removed", description: "Material alert has been deleted." });
    }
  };

  return (
    <div className="space-y-3.5 border rounded-xl border-border/80 bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-500" />
          <h3 className="text-base font-bold text-foreground tracking-tight select-none">Materials Running Low</h3>
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-amber-50 text-amber-600 border-amber-200">
            {materials.length} Pending
          </Badge>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 text-xs flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Alert
        </Button>
      </div>

      {/* Material cards list */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground font-semibold">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading alerts...
        </div>
      ) : materials.length === 0 ? (
        <p className="text-muted-foreground text-xs italic py-6 text-center">No active material alerts reported.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {materials.map((item) => {
            const projectName = item.project?.name || projectsList.find((p) => p.id === item.projectId)?.name || "—";
            const matLines = item.material ? item.material.split("\n").filter(Boolean) : [];
            const qtyLines = item.quantity ? item.quantity.split("\n").filter(Boolean) : [];
            const isMulti = matLines.length > 1;

            return (
              <Card key={item.id} className="relative hover:shadow-md transition-all duration-200 border border-border overflow-hidden">
                <CardContent className="p-3.5 space-y-3">
                  {/* Card Header: Site Name as Headline + Badges/Actions */}
                  <div className="flex justify-between items-start gap-2 pb-2 border-b border-border/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="font-bold text-foreground leading-snug text-sm truncate" title={projectName}>
                          {projectName}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          item.delivered
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                      >
                        {item.delivered ? "Delivered" : "Pending"}
                      </Badge>
                      {!item.delivered && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 p-0"
                          onClick={() => handleMarkDelivered(item)}
                          title="Mark Delivered"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-0 transition-colors"
                        onClick={() => handleDelete(item.id)}
                        title="Delete Alert"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Materials Under Site Name */}
                  <div className="space-y-1.5">
                    {isMulti ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            Materials Required
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                            {matLines.length} Items
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 bg-muted/20 rounded-lg p-2 border border-border/50">
                          {matLines.map((mat, idx) => {
                            const cleanMat = mat.replace(/^\d+\.\s*/, "");
                            const cleanQty = (qtyLines[idx] || "").replace(/^\d+\.\s*/, "");
                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-start gap-2 text-xs py-1 border-b border-border/30 last:border-0 last:pb-0"
                              >
                                <span className="font-semibold text-foreground break-words flex-1">
                                  <span className="text-muted-foreground font-normal mr-1">{idx + 1}.</span>
                                  {cleanMat}
                                </span>
                                <span className="font-bold text-primary shrink-0 text-right">
                                  {cleanQty || "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/50 space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Material Required
                        </span>
                        <div className="flex justify-between items-baseline gap-2 pt-0.5">
                          <h5 className="font-bold text-foreground text-sm break-words flex-1">
                            {item.material}
                          </h5>
                          <span className="font-bold text-primary text-xs shrink-0 text-right bg-background px-2 py-0.5 rounded border border-border/60">
                            {item.quantity}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Logged Date */}
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1.5 border-t border-border/40">
                    <span className="text-[11px] font-medium">Logged Date</span>
                    <span className="font-semibold text-foreground text-xs">{formatDate(item.date || item.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Alert Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl max-h-[90vh]">
          <DialogHeader className="pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-amber-500" />
              <span>Add Material Alert</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Report single or multiple materials running low for a project site.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} noValidate className="space-y-4 pt-2">
            {/* Site & Alert Date Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/70 dark:bg-zinc-900/40 rounded-xl border border-slate-200/80 dark:border-zinc-800">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Site / Project *
                </label>
                <SearchableSelect
                  value={selectedProjectId}
                  displayValue={projectDisplay}
                  options={filteredProjectOptions}
                  placeholder="Select site / project..."
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
                  onEnter={(val) => projectsData.forceServerSearch?.(val)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Alert Date *
                </label>
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

              <div className="space-y-3 pr-1">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 space-y-2 relative shadow-2xs group"
                    style={{ zIndex: items.length + 10 - index }}
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
                          value={item.selectedProductId || item.materialName}
                          displayValue={item.materialName}
                          options={getProductOptionsForRow(item.productFilter)}
                          placeholder={fetchingProject ? "Loading project materials..." : "Search product or type material name"}
                          inputHeight="h-10"
                          onSearchChange={(q) => {
                            updateItemRow(item.id, {
                              productFilter: q,
                              materialName: q ? q : item.materialName,
                              selectedProductId: q ? "" : item.selectedProductId,
                            });
                          }}
                          onSelect={(id, label) => {
                            const cleanName = label.replace(/\s*\(Project\)$/, "");
                            updateItemRow(item.id, {
                              selectedProductId: id,
                              materialName: cleanName,
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

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="font-bold h-9 px-4">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{items.length > 1 ? `Add ${items.length} Alerts` : "Add Alert"}</span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
