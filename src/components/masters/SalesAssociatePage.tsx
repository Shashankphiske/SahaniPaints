import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { User } from "../../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { MasterForm } from "./MasterForm";
import SalesAssociateDashboard from "./SalesAssociateDashboard";
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

const columns: ColumnDef<User>[] = [
  { key: "username", header: "Name" },
  { key: "email", header: "Email" },
  { key: "phonenumber", header: "Phone", render: (u) => u.phonenumber ?? "—" },
  { key: "address", header: "Address", render: (u) => u.address ?? "—" },
  {
    key: "createdAt",
    header: "Created At",
    render: (u) => formatDate(u.createdAt),
  },
];

export default function SalesAssociatePage() {
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
  } = useMasterData<User>("users", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [dashboardItem, setDashboardItem] = useState<User | null>(null);

  const users = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Filter role "SALES_ASSOCIATE" and search term
  const filtered = useMemo(() => {
    const roleFiltered = users.filter((u) => u.role === "SALES_ASSOCIATE");

    if (!search) return roleFiltered;
    const term = search.toLowerCase();

    return roleFiltered.filter(
      (u) =>
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        String(u.phonenumber ?? "").includes(term) ||
        u.address?.toLowerCase().includes(term)
    );
  }, [users, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const roleFiltered = users.filter((u) => u.role === "SALES_ASSOCIATE");
    const localHits = roleFiltered.filter(
      (u) =>
        u.username?.toLowerCase().includes(term.toLowerCase()) ||
        u.email?.toLowerCase().includes(term.toLowerCase()) ||
        String(u.phonenumber ?? "").includes(term) ||
        u.address?.toLowerCase().includes(term.toLowerCase())
    );
    triggerSearch(term, localHits);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const handleSave = (formData: Partial<User>) => {
    const dataWithRole = { ...formData, role: "SALES_ASSOCIATE" as const };
    if (editingItem) {
      update({ id: editingItem.id, data: dataWithRole });
    } else {
      create(dataWithRole);
    }
    closeModal();
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDashboardSave = (formData: Partial<User>) => {
    if (!dashboardItem) return;
    update({
      id: dashboardItem.id,
      data: { ...formData, role: "SALES_ASSOCIATE" as const },
    });
    setDashboardItem(null);
  };

  return (
    <>
      {!dashboardItem && (
        <MasterPageLayout
          title="Sales Associates"
          resource="users"
          importExtraData={{ role: "SALES_ASSOCIATE" }}
          searchPlaceholder="Search sales associates by username or email..."
          onSearch={handleSearch}
          onSearchSubmit={handleSearchSubmit}
          onAdd={() => setIsModalOpen(true)}
        >
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading || isServerSearching}
            onRowClick={(item) => setDashboardItem(item)}
            onEdit={(item) => {
              setEditingItem(item);
              setIsModalOpen(true);
            }}
            onDelete={(item) => {
              if (window.confirm("Delete this sales associate?")) {
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
      )}

      {/* Dashboard details overlay */}
      {dashboardItem && (
        <SalesAssociateDashboard
          associate={dashboardItem}
          onBack={() => setDashboardItem(null)}
          handleSave={handleDashboardSave}
        />
      )}

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Sales Associate" : "Add New Sales Associate"}
            </DialogTitle>
          </DialogHeader>

          <MasterForm
            resource="sales-associates"
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
