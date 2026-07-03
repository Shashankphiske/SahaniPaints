import { useState } from "react";
import { Plus, MoreVertical, Pencil, Trash2, Calendar, Flag, CircleDot } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { MasterForm } from "../masters/MasterForm";
import { useMasterData } from "../../hooks/use-master-data";
import type { Task, Priority, Status } from "../../types/master";

const priorityColors: Record<Priority, string> = {
  HIGH: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-950/20 dark:text-red-400",
  MODERATE: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-400",
  LOW: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400",
};

const statusColors: Record<Status, string> = {
  TODO: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400",
  INPROGRESS: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-950/20 dark:text-blue-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-400",
};

const statusLabels: Record<Status, string> = {
  TODO: "To Do",
  INPROGRESS: "In Progress",
  COMPLETED: "Completed",
};

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

export function TaskSection() {
  const { data, isLoading, create, update, remove } = useMasterData<Task>("tasks");

  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Task | null>(null);
  const [viewItem, setViewItem] = useState<Task | null>(null);

  const items = Array.isArray(data) ? data : [];

  const openCreate = () => {
    setEditingItem(null);
    setIsOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingItem(task);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this task?")) {
      remove(id);
    }
  };

  return (
    <div className="space-y-4 border rounded-xl border-border bg-card p-5 shadow-sm-soft">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold font-display text-foreground select-none">Active Tasks</h3>
        <Button size="sm" onClick={openCreate} className="flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add Task
        </Button>
      </div>

      {/* Task list */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm font-semibold">Loading tasks...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm font-semibold">No tasks scheduled yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onView={() => setViewItem(task)}
              onEdit={() => openEdit(task)}
              onDelete={() => handleDelete(task.id)}
            />
          ))}
        </div>
      )}

      {/* View Modal */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Title</p>
                  <p className="font-semibold text-foreground break-words">{viewItem.title}</p>
                </div>

                {viewItem.description && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Description</p>
                    <p className="text-foreground whitespace-pre-wrap break-words">{viewItem.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Project</p>
                  <p className="font-semibold text-foreground">{viewItem.project?.name || "—"}</p>
                </div>
              </div>

              <div className="border-t border-border pt-3 flex gap-2 flex-wrap">
                <Badge variant="outline" className={priorityColors[viewItem.priority]}>
                  <Flag className="h-3 w-3 mr-1" /> {viewItem.priority}
                </Badge>
                <Badge variant="secondary" className={statusColors[viewItem.status]}>
                  <CircleDot className="h-3 w-3 mr-1" /> {statusLabels[viewItem.status]}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
                <div className="flex justify-between">
                  <span>Task Date</span>
                  <span className="font-semibold text-foreground">{formatDate(viewItem.taskDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created At</span>
                  <span className="font-semibold text-foreground">{formatDate(viewItem.createdAt)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const saved = viewItem;
                    setViewItem(null);
                    openEdit(saved);
                  }}
                >
                  Edit Task
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    handleDelete(viewItem.id);
                    setViewItem(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <MasterForm
            resource="tasks"
            initialData={editingItem ?? undefined}
            editing={!!editingItem}
            onSubmit={(formData) => {
              if (editingItem) {
                update({ id: editingItem.id, data: formData });
              } else {
                create(formData);
              }
              setIsOpen(false);
              setEditingItem(null);
            }}
            onCancel={() => {
              setIsOpen(false);
              setEditingItem(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TaskCardProps {
  task: Task;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskCard({ task, onView, onEdit, onDelete }: TaskCardProps) {
  return (
    <Card
      onClick={onView}
      className="relative cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200 border border-border"
    >
      <div
        className="absolute top-2.5 right-2.5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 p-0 rounded-full hover:bg-muted">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2 text-primary" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2 text-destructive" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="p-5 pr-10 space-y-3">
        <h4 className="font-bold text-foreground leading-snug line-clamp-1 pr-2 text-sm">
          {task.title}
        </h4>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${
              priorityColors[task.priority]
            }`}
          >
            {task.priority}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${
              statusColors[task.status]
            }`}
          >
            {statusLabels[task.status]}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(task.taskDate)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
