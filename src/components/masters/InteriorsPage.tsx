import { useState, useMemo } from "react";
import { MasterPageLayout } from "./MasterPageLayout";
import { DataTable } from "./DataTable";
import type { ColumnDef } from "./DataTable";
import { useMasterData } from "../../hooks/use-master-data";
import type { User } from "../../types/master";
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
  } = useMasterData<User>("users", true, undefined, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [dashboardItem, setDashboardItem] = useState<User | null>(null);

  // Filter role "INTERIOR" and search term
  const filtered = useMemo(() => {
    const items = Array.isArray(data) ? data : [];
    const roleFiltered = items.filter((u) => u.role === "INTERIOR");

    if (!search) return roleFiltered;
    const term = search.toLowerCase();

    return roleFiltered.filter(
      (u) =>
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        String(u.phonenumber ?? "").includes(term) ||
        u.address?.toLowerCase().includes(term)
    );
  }, [data, search]);

  const handleSearch = (term: string) => {
    setSearch(term);
    const items = Array.isArray(data) ? data : [];
    const roleFiltered = items.filter((u) => u.role === "INTERIOR");
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
    const dataWithRole = { ...formData, role: "INTERIOR" as const };
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
      data: { ...formData, role: "INTERIOR" as const },
    });
    setDashboardItem(null);
  };

  return (
    <>
      {!dashboardItem && (
        <MasterPageLayout
          title="Interior Designers"
          resource="users"
          importExtraData={{ role: "INTERIOR" }}
          searchPlaceholder="Search interior designers by username or email..."
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
              if (window.confirm("Delete this interior designer?")) {
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
        <InteriorDashboard
          interior={dashboardItem}
          onBack={() => setDashboardItem(null)}
          handleSave={handleDashboardSave}
        />
      )}

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Interior" : "Add New Interior"}
            </DialogTitle>
          </DialogHeader>

          <MasterForm
            resource="interiors"
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
