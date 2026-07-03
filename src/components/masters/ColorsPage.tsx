import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Color } from "../../types/master";
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

const columns: ColumnDef<Color>[] = [
  { key: "name", header: "Color Name" },
  { key: "shade", header: "Shade Number" },
  {
    key: "createdAt",
    header: "Created At",
    render: (c) => formatDate(c.createdAt),
  },
];

export default function ColorsPage() {
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
  } = useMasterData<Color>("colors", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Color | null>(null);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.shade?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter((c) => {
      const t = term.toLowerCase();
      return (
        c.name?.toLowerCase().includes(t) ||
        c.shade?.toLowerCase().includes(t)
      );
    });
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Color>) => {
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
        title="Colors"
        resource="colors"
        searchPlaceholder="Search colors by name or shade..."
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
            if (window.confirm("Are you sure you want to delete this color?")) {
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
            <DialogTitle>{editingItem ? "Edit Color" : "Add New Color"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="colors"
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
