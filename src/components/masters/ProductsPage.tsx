import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Product } from "../../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import { ChevronDown, Loader2 } from "lucide-react";

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

const columns: ColumnDef<Product>[] = [
  { key: "name", header: "Name" },
  { key: "brand", header: "Brand", render: (p) => p.brand?.name ?? "—" },
  { key: "category", header: "Category" },
  {
    key: "price",
    header: "Price",
    render: (p) => `₹${Number(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    key: "size",
    header: "Pack Size",
    render: (p) => p.size || "1ltr",
  },
  {
    key: "coverage",
    header: "Coverage (per L)",
    render: (p) => {
      const parts = [];
      if (p.coverageSqFt !== undefined && p.coverageSqFt !== null && p.coverageSqFt !== "") {
        const sq = Number(p.coverageSqFt);
        if (!isNaN(sq)) parts.push(`${sq} sq.ft`);
      }
      if (p.coverageRnFt !== undefined && p.coverageRnFt !== null && p.coverageRnFt !== "") {
        const rn = Number(p.coverageRnFt);
        if (!isNaN(rn)) parts.push(`${rn} rn.ft`);
      }
      return parts.length > 0 ? parts.join(" / ") : "—";
    },
  },
  {
    key: "hasToken",
    header: "Token",
    render: (p) => (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.hasToken ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-400"}`}>
        {p.hasToken ? "Yes" : "No"}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Created At",
    render: (p) => formatDate(p.createdAt),
  },
];

export default function ProductsPage() {
  const {
    data,
    isLoading,
    create,
    update,
    remove,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    triggerSearch,
    forceServerSearch,
    isServerSearching,
  } = useMasterData<Product>("products", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.brand?.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter((p) => {
      const t = term.toLowerCase();
      return (
        p.name?.toLowerCase().includes(t) ||
        p.brand?.name?.toLowerCase().includes(t) ||
        p.category?.toLowerCase().includes(t)
      );
    });
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Product>) => {
    if (editingItem) {
      update({ id: editingItem.id, data: formData });
    } else {
      create(formData);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <>
      <MasterPageLayout
        title="Products"
        resource="products"
        searchPlaceholder="Search products by name, brand or category..."
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        onAdd={() => setIsModalOpen(true)}
      >
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading || isServerSearching}
          onEdit={(item) => {
            setEditingItem(item);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            if (window.confirm("Are you sure you want to delete this product?")) {
              remove(item.id);
            }
          }}
        />

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ChevronDown className="h-5 w-5 animate-bounce" />
                  <span className="text-xs font-semibold">Load more</span>
                </>
              )}
            </button>
          </div>
        )}
      </MasterPageLayout>

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="products"
            initialData={editingItem ?? undefined}
            onSubmit={handleSave}
            onCancel={closeModal}
            editing={!!editingItem}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
