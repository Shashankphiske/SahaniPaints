import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Labour } from "../../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import { ChevronDown, Loader2 } from "lucide-react";
import LabourDashboard from "./LabourDashboard";

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

const formatCurrency = (amount: any) => {
  const parsed = Number(amount);
  if (isNaN(parsed)) return "—";
  return `₹${parsed.toLocaleString("en-IN", { maximumFractionDigits: 2 })} per day`;
};

const columns: ColumnDef<Labour>[] = [
  { key: "name", header: "Labour Name" },
  {
    key: "paymentPerDay",
    header: "Payment Per Day",
    render: (l) => formatCurrency(l.paymentPerDay),
  },
  {
    key: "phonenumber",
    header: "Phone Number",
    render: (l) => l.phonenumber ?? "—",
  },
  {
    key: "createdAt",
    header: "Created At",
    render: (l) => formatDate(l.createdAt),
  },
];

export default function LaboursPage() {
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
  } = useMasterData<Labour>("labours", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Labour | null>(null);
  const [selectedLabour, setSelectedLabour] = useState<Labour | null>(null);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (l) =>
        l.name?.toLowerCase().includes(term) ||
        l.phonenumber?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter((l) => {
      const t = term.toLowerCase();
      return (
        l.name?.toLowerCase().includes(t) ||
        l.phonenumber?.toLowerCase().includes(t)
      );
    });
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Labour>) => {
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

  if (selectedLabour) {
    return (
      <LabourDashboard
        labour={selectedLabour}
        onBack={() => setSelectedLabour(null)}
        handleSave={(formData) => {
          update({ id: selectedLabour.id, data: formData });
          setSelectedLabour((prev) => prev ? { ...prev, ...formData } : null);
        }}
      />
    );
  }

  return (
    <>
      <MasterPageLayout
        title="Labours"
        resource="labours"
        searchPlaceholder="Search labours by name or phone..."
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        onAdd={() => setIsModalOpen(true)}
      >
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading || isServerSearching}
          onRowClick={(item) => setSelectedLabour(item)}
          onEdit={(item) => {
            setEditingItem(item);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            if (window.confirm("Are you sure you want to delete this labourer?")) {
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
            <DialogTitle>{editingItem ? "Edit Labour" : "Add New Labour"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="labours"
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
