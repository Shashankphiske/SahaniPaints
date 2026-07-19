import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Interior } from "../../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import InteriorDashboard from "./InteriorDashboard";
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

const columns: ColumnDef<Interior>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email", render: (i) => i.email ?? "—" },
  { key: "phonenumber", header: "Phone", render: (i) => i.phonenumber ?? "—" },
  { key: "address", header: "Address", render: (i) => i.address ?? "—" },
  {
    key: "commissionFeePercentage",
    header: "Commission Rate",
    render: (i) =>
      i.commissionFeePercentage != null
        ? `${Number(i.commissionFeePercentage).toFixed(2)}%`
        : "—",
  },
  {
    key: "createdAt",
    header: "Created At",
    render: (i) => formatDate(i.createdAt),
  },
];

export default function InteriorsPage() {
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
  } = useMasterData<Interior>("interiors", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Interior | null>(null);
  const [dashboardItem, setDashboardItem] = useState<Interior | null>(null);

  const filtered = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    if (!search) return items;
    const term = search.toLowerCase();

    return items.filter(
      (i) =>
        i.name?.toLowerCase().includes(term) ||
        i.email?.toLowerCase().includes(term) ||
        String(i.phonenumber ?? "").includes(term) ||
        i.address?.toLowerCase().includes(term)
    );
  }, [data, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const items = Array.isArray(data) ? data : [];
    const localHits = items.filter(
      (i) =>
        i.name?.toLowerCase().includes(term.toLowerCase()) ||
        i.email?.toLowerCase().includes(term.toLowerCase()) ||
        String(i.phonenumber ?? "").includes(term) ||
        i.address?.toLowerCase().includes(term.toLowerCase())
    );
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Interior>) => {
    if (editingItem) {
      update({ id: editingItem.id, data: formData });
    } else {
      create(formData);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleEdit = (item: Interior) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (item: Interior) => {
    if (
      window.confirm(`Are you sure you want to delete "${item.name}"?`)
    ) {
      remove(item.id);
    }
  };

  return (
    <MasterPageLayout
      title="Interior Designers"
      resource="interiors"
      searchPlaceholder="Search interior designers by name, phone or email..."
      onSearch={handleSearch}
      onSearchSubmit={handleSearchSubmit}
      onAdd={() => {
        setEditingItem(null);
        setIsModalOpen(true);
      }}
    >
      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRowClick={(item) => setDashboardItem(item)}
      />

      {hasNextPage && (
        <div className="flex justify-center mt-4 pb-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading more...
              </>
            ) : (
              <>
                Load More
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Interior Designer" : "Add Interior Designer"}
            </DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="interiors"
            initialData={editingItem || undefined}
            editing={!!editingItem}
            onSubmit={handleSave}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingItem(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Designer Dashboard View */}
      {dashboardItem && (
        <InteriorDashboard
          interior={dashboardItem as any}
          onClose={() => setDashboardItem(null)}
        />
      )}
    </MasterPageLayout>
  );
}
