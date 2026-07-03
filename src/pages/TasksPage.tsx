import { useState, useMemo } from "react";
import { MasterPageLayout } from "../components/masters/MasterPageLayout";
import type { FilterConfig } from "../components/masters/MasterPageLayout";
import { DataTable } from "../components/masters/DataTable";
import type { ColumnDef } from "../components/masters/DataTable";
import { useMasterData } from "../hooks/use-master-data";
import type { Task } from "../types/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { MasterForm } from "../components/masters/MasterForm";
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

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
  MODERATE: "text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
  LOW: "text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
};

const STATUS_STYLES: Record<string, string> = {
  TODO: "text-red-500 font-semibold bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
  INPROGRESS: "text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
  COMPLETED: "text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full text-xs inline-block uppercase",
};

export default function TasksPage({ projectId }: { projectId?: string }) {
  const {
    data,
    isLoading,
    create,
    update,
    remove,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    forceServerSearch,
    isServerSearching,
  } = useMasterData<Task>("tasks", true, { projectId }, true);

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Task | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const tasks = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : [];
  }, [data]);

  const TASK_FILTERS: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { label: "To Do", value: "TODO" },
        { label: "In Progress", value: "INPROGRESS" },
        { label: "Completed", value: "COMPLETED" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      type: "select",
      options: [
        { label: "High", value: "HIGH" },
        { label: "Moderate", value: "MODERATE" },
        { label: "Low", value: "LOW" },
      ],
    },
  ];

  const handleFilterChange = (filters: Record<string, string>) => {
    setActiveFilters(filters);
  };

  const handleFilterSubmit = (filters: Record<string, string>) => {
    setActiveFilters(filters);
    forceServerSearch(search, filters);
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return tasks.filter((t) => {
      const matchesSearch =
        !search ||
        t.title?.toLowerCase().includes(term) ||
        t.status?.toLowerCase().includes(term) ||
        t.priority?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.project?.name?.toLowerCase().includes(term);

      const matchesProject = !projectId || t.projectId === projectId;

      for (const [key, value] of Object.entries(activeFilters)) {
        if (value && (t as any)[key] !== value) {
          return false;
        }
      }

      return matchesSearch && matchesProject;
    });
  }, [tasks, search, projectId, activeFilters]);

  const handleSearch = (term: string) => {
    setSearch(term);
  };

  const handleSearchSubmit = (term: string) => {
    setSearch(term);
    forceServerSearch(term);
  };

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      { key: "title", header: "Task Name" },
      {
        key: "priority",
        header: "Priority",
        render: (t) => (
          <span className={PRIORITY_STYLES[t.priority] ?? ""}>{t.priority}</span>
        ),
      },
      {
        key: "projectId",
        header: "Project",
        render: (t) => t.project?.name ?? "—",
      },
      {
        key: "taskDate",
        header: "Due Date",
        render: (t) => formatDate(t.taskDate),
      },
      {
        key: "status",
        header: "Status",
        render: (t) => (
          <span className={STATUS_STYLES[t.status] ?? ""}>{t.status}</span>
        ),
      },
      {
        key: "description",
        header: "Description",
        render: (t) => t.description ?? "—",
      },
      {
        key: "createdAt",
        header: "Created At",
        render: (t) => formatDate(t.createdAt),
      },
    ],
    []
  );

  const handleSave = (formData: Partial<Task>) => {
    const payload = {
      ...formData,
      projectId: formData.projectId || projectId,
    };

    if (editingItem) {
      update({ id: editingItem.id, data: payload });
    } else {
      create(payload);
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
        title="Tasks"
        searchPlaceholder="Search tasks by title or description..."
        onSearch={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        onFilterChange={handleFilterChange}
        onFilterSubmit={handleFilterSubmit}
        filters={TASK_FILTERS}
        onAdd={() => setIsModalOpen(true)}
      >
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          onEdit={(item) => {
            setEditingItem(item);
            setIsModalOpen(true);
          }}
          onDelete={(item) => {
            if (window.confirm("Are you sure you want to delete this task?")) {
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
            <DialogTitle>{editingItem ? "Edit Task" : "Add New Task"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="tasks"
            initialData={editingItem ?? { projectId }}
            editing={!!editingItem}
            onSubmit={handleSave}
            onCancel={closeModal}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
