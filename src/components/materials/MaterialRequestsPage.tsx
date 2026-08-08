import { useState, useMemo } from "react";
import { useMasterData } from "@/hooks/use-master-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Search, ClipboardList, Loader2 } from "lucide-react";
import type { LowMaterial, Project, Product } from "@/types/master";

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

export default function MaterialRequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const { data: requestsRaw, isLoading, create, update, remove } = useMasterData<LowMaterial>("low-materials");
  const projectsData = useMasterData<Project>("projects");
  const productsData = useMasterData<Product>("products");

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDisplay, setProjectDisplay] = useState(""); // shown in the input when selected
  const [projectFilter, setProjectFilter] = useState("");   // live typed query for filtering options
  const [selectedProductId, setSelectedProductId] = useState("");
  const [materialName, setMaterialName] = useState("");     // final material name (submitted)
  const [productFilter, setProductFilter] = useState("");   // live typed query for filtering products
  const [quantity, setQuantity] = useState("");
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");

  const requests = useMemo(() => (Array.isArray(requestsRaw) ? requestsRaw : []), [requestsRaw]);
  const projectsList = useMemo(() => (Array.isArray(projectsData.data) ? projectsData.data : []), [projectsData.data]);
  const productsList = useMemo(() => (Array.isArray(productsData.data) ? productsData.data : []), [productsData.data]);

  // Project options filtered by whatever the user is typing
  const filteredProjectOptions = useMemo(() =>
    projectsList
      .filter((p) => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
      .slice(0, 10)
      .map((p) => ({ id: p.id, label: p.name })),
    [projectsList, projectFilter]
  );

  // Product options filtered by whatever the user is typing
  const filteredProductOptions = useMemo(() =>
    productsList
      .filter((p) => !productFilter || p.name.toLowerCase().includes(productFilter.toLowerCase()))
      .slice(0, 15)
      .map((p) => ({ id: p.id, label: p.name })),
    [productsList, productFilter]
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
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
    const finalMaterial = materialName.trim();
    if (!finalMaterial) {
      toast({ title: "Validation Error", description: "Please select or type a material.", variant: "destructive" });
      return;
    }
    if (!quantity.trim()) {
      toast({ title: "Validation Error", description: "Please enter quantity.", variant: "destructive" });
      return;
    }

    try {
      create({
        projectId: selectedProjectId,
        material: finalMaterial,
        quantity: quantity.trim(),
        date: new Date(requestDate).toISOString(),
        approved: false,
        delivered: false,
      } as any);

      toast({ title: "Request Added", description: "Material request added successfully." });
      setIsOpen(false);
      // Reset Form
      setSelectedProjectId("");
      setProjectDisplay("");
      setProjectFilter("");
      setSelectedProductId("");
      setMaterialName("");
      setProductFilter("");
      setQuantity("");
      setRequestDate(new Date().toISOString().split("T")[0]);
    } catch (err: any) {
      toast({ title: "Error creating request", description: err.message, variant: "destructive" });
    }
  };

  const handleApprove = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { approved: true } as any
    });
    toast({ title: "Request Approved", description: "Office approval recorded." });
  };

  const handleDeliver = (req: LowMaterial) => {
    update({
      id: req.id,
      data: { delivered: true } as any
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
              Add Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New Material Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Site / Project *</label>
                <SearchableSelect
                  value={selectedProjectId}
                  displayValue={projectDisplay}
                  options={filteredProjectOptions}
                  placeholder="Select site"
                  onSearchChange={(q) => {
                    // Only update the filter query — never clear the display label here.
                    // onSearchChange("") is called internally by SearchableSelect on blur
                    // and after selection; those should NOT clear the selection.
                    setProjectFilter(q);
                  }}
                  onSelect={(id, label) => {
                    setSelectedProjectId(id);
                    setProjectDisplay(label);
                    setProjectFilter(""); // clear search query, keep display label
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
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Material Required *</label>
                <SearchableSelect
                  value={selectedProductId}
                  displayValue={materialName}
                  options={filteredProductOptions}
                  placeholder="Search products or type custom material"
                  onSearchChange={(q) => {
                    setProductFilter(q);
                    if (q) {
                      // User is actively typing — update the free-type material name
                      setMaterialName(q);
                      if (selectedProductId) setSelectedProductId(""); // reset catalog pick
                    }
                    // q="" is called internally by SearchableSelect on blur/after-select — ignore it
                  }}
                  onSelect={(id, label) => {
                    setSelectedProductId(id);
                    setMaterialName(label);
                    setProductFilter(""); // clear filter query, keep display
                  }}
                  onClear={() => {
                    setSelectedProductId("");
                    setMaterialName("");
                    setProductFilter("");
                  }}
                  onEnter={(val) => {
                    productsData.forceServerSearch(val);
                    setMaterialName(val); // allow custom typed material on Enter
                  }}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Quantity *</label>
                  <Input
                    placeholder="e.g. 50 Ltrs / 4 Buckets"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Request Date *</label>
                  <Input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" className="font-bold">
                  Submit Request
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
                    <TableCell className="font-semibold text-xs text-indigo-650 dark:text-indigo-400">{req.material}</TableCell>
                    <TableCell className="font-medium text-xs">{req.quantity}</TableCell>
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
