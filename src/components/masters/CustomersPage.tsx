import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { Customer } from "../../types/master";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import CustomerDashboard from "./CustomerDashboard";
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

const columns: ColumnDef<Customer>[] = [
  { key: "name", header: "Name" },
  { key: "phonenumber", header: "Phone", render: (c) => c.phonenumber ?? "—" },
  { key: "email", header: "Email", render: (c) => c.email ?? "—" },
  {
    key: "alternatePhonenumber",
    header: "Alt. Phone",
    render: (c) => c.alternatePhonenumber ?? "—",
  },
  { key: "address", header: "Address", render: (c) => c.address ?? "—" },
  {
    key: "createdAt",
    header: "Created At",
    render: (c) => formatDate(c.createdAt),
  },
];

export default function CustomersPage() {
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
  } = useMasterData<Customer>("customers", true, undefined, true);

  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Safe flattening
  const items: Customer[] = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data]
  );

  // Filter fallback (local)
  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        String(c.phonenumber ?? "").includes(search) ||
        String(c.alternatePhonenumber ?? "").includes(search)
    );
  }, [items, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const localHits = items.filter(
      (c) =>
        c.name?.toLowerCase().includes(term.toLowerCase()) ||
        c.email?.toLowerCase().includes(term.toLowerCase()) ||
        String(c.phonenumber ?? "").includes(term) ||
        String(c.alternatePhonenumber ?? "").includes(term)
    );
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: any) => {
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
      {!editingItem && (
        <MasterPageLayout
          title="Customers"
          resource="customers"
          searchPlaceholder="Search customers by name, phone or email..."
          onSearch={handleSearch}
          onSearchSubmit={handleSearchSubmit}
          onAdd={() => setIsModalOpen(true)}
        >
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading || isServerSearching}
            onRowClick={(item) => setEditingItem(item)}
            onEdit={(item) => {
              setEditingItem(item);
              setIsModalOpen(true);
            }}
            onDelete={(item) => {
              if (
                window.confirm("Are you sure you want to delete this customer?")
              ) {
                remove(item.id);
              }
            }}
          />

          {/* Load More Pagination */}
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
      )}

      {/* Customer Dashboard ledger view */}
      {editingItem && !isModalOpen && (
        <CustomerDashboard
          customer={editingItem}
          onBack={() => setEditingItem(null)}
          handleSave={handleSave}
        />
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
          </DialogHeader>

          <MasterForm
            resource="customers"
            initialData={editingItem ?? undefined}
            editing={!!editingItem}
            onSubmit={handleSave}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
