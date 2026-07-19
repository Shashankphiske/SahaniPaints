import { useState } from "react";
import { Plus, Phone, Calendar, MessageSquare, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useMasterData } from "../../hooks/use-master-data";
import type { Inquiry, InquiryData } from "../../types/master";

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

export function InquirySection() {
  const { data, isLoading, create, update, remove } = useMasterData<Inquiry>("inquiries");

  const [isOpen, setIsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inquiry | null>(null);
  const [form, setForm] = useState<Partial<InquiryData>>({});
  const [viewItem, setViewItem] = useState<Inquiry | null>(null);

  const items = Array.isArray(data) ? data : [];

  const openCreate = () => {
    setEditingItem(null);
    setForm({});
    setIsOpen(true);
  };

  const openEdit = (inq: Inquiry) => {
    setEditingItem(inq);
    setForm({
      projectName: inq.projectName,
      customerName: inq.customerName,
      phonenumber: inq.phonenumber,
      comments: inq.comments ?? "",
      followUpDate: inq.followUpDate ? String(inq.followUpDate).split("T")[0] : "",
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this inquiry?")) {
      remove(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName || !form.customerName || !form.phonenumber || !form.followUpDate) return;

    const submissionData = {
      ...form,
      phonenumber: String(form.phonenumber),
      followUpDate: new Date(form.followUpDate as string).toISOString(),
    };

    if (editingItem) {
      update({ id: editingItem.id, data: submissionData as any });
    } else {
      create(submissionData as any);
    }

    setForm({});
    setEditingItem(null);
    setIsOpen(false);
  };

  return (
    <div className="space-y-3.5 border rounded-xl border-border/80 bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <h3 className="text-base font-bold text-foreground tracking-tight select-none">Active Inquiries</h3>
        <Button size="sm" onClick={openCreate} className="h-8 text-xs flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Inquiry
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm font-semibold">Loading inquiries...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm font-semibold">No inquiries registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {items.map((inq) => (
            <InquiryCard
              key={inq.id}
              inq={inq}
              onView={() => setViewItem(inq)}
              onEdit={() => openEdit(inq)}
              onDelete={() => handleDelete(inq.id)}
            />
          ))}
        </div>
      )}

      {/* View modal */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Inquiry Profile Details</DialogTitle>
          </DialogHeader>

          {viewItem && (
            <div className="space-y-4 text-sm">
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Project Name</p>
                  <p className="font-semibold text-foreground break-words">{viewItem.projectName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Customer</p>
                  <p className="font-semibold text-foreground break-words">{viewItem.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase font-semibold">Phone Number</p>
                  <p className="font-semibold text-foreground">{viewItem.phonenumber}</p>
                </div>
                {viewItem.comments && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-semibold">Comments</p>
                    <p className="text-foreground whitespace-pre-wrap break-words">{viewItem.comments}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Follow-up Date</span>
                  <span className="font-semibold text-foreground">{formatDate(viewItem.followUpDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Created Date</span>
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
                  Edit Details
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Inquiry Details" : "Create New Inquiry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Project Name *</label>
              <Input
                value={form.projectName ?? ""}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                placeholder="e.g. Living Room Repaint"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Customer Name *</label>
              <Input
                value={form.customerName ?? ""}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Customer full name"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Phone Number *</label>
              <Input
                type="tel"
                value={form.phonenumber ?? ""}
                onChange={(e) => setForm({ ...form, phonenumber: e.target.value })}
                placeholder="Phone connection string"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Follow-up Date *</label>
              <Input
                type="date"
                value={form.followUpDate ? String(form.followUpDate).split("T")[0] : ""}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-muted-foreground">Comments</label>
              <Textarea
                value={form.comments ?? ""}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                placeholder="Details or specific notes on paint specs..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingItem ? "Update" : "Save"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface InquiryCardProps {
  inq: Inquiry;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function InquiryCard({ inq, onView, onEdit, onDelete }: InquiryCardProps) {
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
        <h4 className="font-bold text-foreground leading-snug pr-2 break-words text-sm">
          {inq.projectName}
        </h4>
        <p className="text-xs font-semibold text-muted-foreground break-words uppercase tracking-wider">
          {inq.customerName}
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span>{inq.phonenumber}</span>
          </div>
          {inq.comments && (
            <div className="flex items-start gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{inq.comments}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1 font-semibold text-primary/80">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(inq.followUpDate)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
