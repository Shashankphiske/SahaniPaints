import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Brand } from "../../types/master";
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

const columns: ColumnDef<Brand>[] = [
  { key: "name", header: "Name" },
  { key: "description", header: "Description", render: (b) => b.description ?? "—" },
  {
    key: "createdAt",
    header: "Created At",
    render: (b) => formatDate(b.createdAt),
  },
];

export default function BrandsPage() {
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
  } = useMasterData<Brand>("brands", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Brand | null>(null);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (b) =>
        b.name?.toLowerCase().includes(term) ||
        b.description?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter((b) => {
      const t = term.toLowerCase();
      return (
        b.name?.toLowerCase().includes(t) ||
        b.description?.toLowerCase().includes(t)
      );
    });
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Brand>) => {
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
        title="Brands"
        resource="brands"
        searchPlaceholder="Search brands by name or description..."
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
            if (window.confirm("Are you sure you want to delete this brand?")) {
              remove(item.id);
            }
          }}
        />

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
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
            <DialogTitle>{editingItem ? "Edit Brand" : "Add New Brand"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="brands"
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
