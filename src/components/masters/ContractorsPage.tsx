import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Contractor } from "../../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import { ChevronDown, Loader2 } from "lucide-react";
import ContractorDashboard from "./ContractorDashboard";

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

const columns: ColumnDef<Contractor>[] = [
  { key: "name", header: "Contractor Name" },
  {
    key: "type",
    header: "Type",
    render: (c) => {
      const isMonthly = c.type === "MONTHLY";
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
          isMonthly
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/40"
            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40"
        }`}>
          {isMonthly ? "Monthly" : "Weekly"}
        </span>
      );
    }
  },
  {
    key: "phonenumber",
    header: "Phone Number",
    render: (c) => c.phonenumber ?? "—",
  },
  {
    key: "email",
    header: "Email Address",
    render: (c) => c.email ?? "—",
  },
  {
    key: "createdAt",
    header: "Created At",
    render: (c) => formatDate(c.createdAt),
  },
];

export default function ContractorsPage() {
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
  } = useMasterData<Contractor>("contractors", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Contractor | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.phonenumber?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter((c) => {
      const t = term.toLowerCase();
      return (
        c.name?.toLowerCase().includes(t) ||
        c.phonenumber?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t)
      );
    });
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<Contractor>) => {
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

  if (selectedContractor) {
    return (
      <ContractorDashboard
        contractor={selectedContractor}
        onBack={() => setSelectedContractor(null)}
        handleSave={(formData) => {
          update({ id: selectedContractor.id, data: formData });
          setSelectedContractor((prev) => prev ? { ...prev, ...formData } : null);
        }}
      />
    );
  }

  return (
    <>
      <MasterPageLayout
        title="Contractors"
        resource="contractors"
        searchPlaceholder="Search contractors by name, phone or email..."
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        onAdd={() => setIsModalOpen(true)}
      >
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading || isServerSearching}
          onRowClick={(item) => setSelectedContractor(item)}
          onEdit={(item) => {
            setEditingItem(item);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            if (window.confirm("Are you sure you want to delete this contractor?")) {
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
            <DialogTitle>{editingItem ? "Edit Contractor" : "Add New Contractor"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="contractors"
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
