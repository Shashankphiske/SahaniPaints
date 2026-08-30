import { useState, useMemo } from "react";
import { Plus, Trash2, CheckCircle, Package, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/SearchableSelect";
import { useMasterData } from "../../hooks/use-master-data";
import { toast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/api";
import type { LowMaterial, Project, Product } from "../../types/master";

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

export function LowMaterialsSection() {
  const { data: materialsRaw, isLoading, create, update, remove } = useMasterData<LowMaterial>("low-materials");
  const projectsData = useMasterData<Project>("projects");
  const productsData = useMasterData<Product>("products");
  const projectsRaw = projectsData.data;
  const productsRaw = productsData.data;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const materials = useMemo(() => (Array.isArray(materialsRaw) ? materialsRaw : []), [materialsRaw]);
  const projectsList = useMemo(() => (Array.isArray(projectsRaw) ? projectsRaw : []), [projectsRaw]);
  const productsList = useMemo(() => (Array.isArray(productsRaw) ? productsRaw : []), [productsRaw]);

  const activeProjects = useMemo(() => {
    return projectsList;
  }, [projectsList]);

  const handleProjectSearchSubmit = async (query: string) => {
    if (!query.trim()) return;
    try {
      const results = await apiRequest.fetchAll<Project>("projects", { search: query });
      if (Array.isArray(results)) {
        results.forEach((item) => {
          projectsData.prependToAllCaches(item);
        });
      }
    } catch (err) {
      console.error("Failed to search projects:", err);
    }
  };

  const handleProductSearchSubmit = async (query: string) => {
    if (!query.trim()) return;
    try {
      const results = await apiRequest.fetchAll<Product>("products", { search: query });
      if (Array.isArray(results)) {
        results.forEach((item) => {
          productsData.prependToAllCaches(item);
        });
      }
    } catch (err) {
      console.error("Failed to search products:", err);
    }
  };

  const matchedProject = projectsList.find((p) => p.id === selectedProjectId);

  const openCreate = () => {
    setSelectedProjectId("");
    setProjectSearch("");
    setSelectedProductId("");
    setProductSearch("");
    setMaterialName("");
    setQuantity("");
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      toast({ title: "Validation Error", description: "Please select a project site.", variant: "destructive" });
      return;
    }
    if (!materialName.trim()) {
      toast({ title: "Validation Error", description: "Please enter a material name.", variant: "destructive" });
      return;
    }
    if (!quantity.trim()) {
      toast({ title: "Validation Error", description: "Please enter a quantity.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      create({
        projectId: selectedProjectId,
        material: materialName.trim(),
        quantity: quantity.trim(),
        delivered: false
      });
      setIsOpen(false);
      toast({ title: "Alert Created", description: `Added low material alert for ${materialName}.` });
    } catch (err: any) {
      toast({ title: "Failed to log material", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDelivered = (item: LowMaterial) => {
    try {
      update({
        id: item.id,
        data: { delivered: true }
      });
      toast({ title: "Status Updated", description: `${item.material} marked as delivered.` });
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
            {materials.filter(m => !m.delivered).length} Pending
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
          {materials.map((item) => (
            <Card key={item.id} className="relative hover:shadow-md transition-all duration-200 border border-border overflow-hidden">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-foreground leading-snug text-sm truncate">
                      {item.material}
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                      Qty Required: <span className="text-foreground font-bold">{item.quantity}</span>
                    </p>
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

                <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                  <div className="flex justify-between items-center">
                    <span>Site/Project</span>
                    <span className="font-semibold text-primary truncate max-w-[65%]" title={item.project?.name}>
                      {item.project?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Logged Date</span>
                    <span className="font-semibold text-foreground">{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Alert Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material Alert</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-500 uppercase">Choose Site / Project *</label>
              <SearchableSelect
                value={selectedProjectId}
                displayValue={matchedProject?.name || ""}
                options={activeProjects
                  .filter((p) => !projectSearch || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Search active project site..."
                onSearchChange={setProjectSearch}
                onSelect={(id) => setSelectedProjectId(id)}
                onClear={() => {
                  setSelectedProjectId("");
                  setProjectSearch("");
                }}
                onEnter={handleProjectSearchSubmit}
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-500 uppercase">Material Required *</label>
              <SearchableSelect
                value={selectedProductId}
                displayValue={materialName}
                options={productsList
                  .filter((p) => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .slice(0, 10)
                  .map((p) => ({ id: p.id, label: p.name }))}
                placeholder="Search and select material..."
                onSearchChange={setProductSearch}
                onSelect={(id, label) => {
                  setSelectedProductId(id);
                  setMaterialName(label);
                }}
                onClear={() => {
                  setSelectedProductId("");
                  setMaterialName("");
                  setProductSearch("");
                }}
                onEnter={handleProductSearchSubmit}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Quantity *</label>
              <Input
                placeholder="e.g. 5 Buckets (20L) / 4 bags"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add Alert"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
