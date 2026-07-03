import { useState, useMemo } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useMasterData } from "../hooks/use-master-data";
import { ArrowLeft, Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { cn } from "../lib/utils";

interface User {
  id: string;
  username: string;
  email: string;
  role?: string;
}

interface Authorization {
  id: string;
  userId: string;
  access: string;
}

const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "brands", label: "Brands" },
  { key: "products", label: "Products" },
  { key: "interiors", label: "Interiors" },
  { key: "sales-associate", label: "Sales Associates" },
  { key: "tasks", label: "Tasks" },
  { key: "settings", label: "Settings" },
  { key: "colors", label: "Colors" },
  { key: "site-colors", label: "Site Colors" },
  { key: "labours", label: "Labours" },
  { key: "labour-attendance", label: "Labour Attendance" },
];

const collectAccess = (records: Authorization[]): Set<string> => {
  const set = new Set<string>();
  records.forEach((r) => {
    if (r.access) set.add(String(r.access).trim());
  });
  return set;
};

const getInitials = (name: string) =>
  name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "US";

function EditUserModal({
  user,
  onSave,
  onClose,
}: {
  user: User;
  onSave: (data: Partial<User>) => Promise<void>;
  onClose: () => void;
}) {
  const [username, setUserName] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role ?? "INTERIOR");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ username, email, role });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
            <Input
              value={username}
              onChange={(e) => setUserName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="INTERIOR">INTERIOR</option>
              <option value="SALES_ASSOCIATE">SALES_ASSOCIATE</option>
              <option value="USER">USER</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserDetailPage({
  user,
  userAuthorizations,
  onBack,
  onSaveAuth,
}: {
  user: User;
  userAuthorizations: Authorization[];
  onBack: () => void;
  onSaveAuth: (
    userId: string,
    nextAccess: Set<string>,
    existingRecords: Authorization[]
  ) => Promise<void>;
}) {
  const [access, setAccess] = useState<Set<string>>(
    collectAccess(userAuthorizations)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toggle = (key: string) => {
    setAccess((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const setAll = (all: boolean) => {
    setAccess(all ? new Set(ALL_PAGES.map((p) => p.key)) : new Set());
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveAuth(user.id, access, userAuthorizations);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground -ml-2 flex items-center gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Button>

      {/* User profile card */}
      <div className="p-6 flex items-center gap-5 bg-card border border-border rounded-xl shadow-sm-soft">
        <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-display font-bold shrink-0">
          {getInitials(user.username)}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-display font-bold text-foreground truncate">
            {user.username}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          {user.role && (
            <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary uppercase rounded-full">
              {user.role}
            </span>
          )}
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-3xl font-display font-extrabold text-primary">
            {access.size}
          </p>
          <p className="text-xs text-muted-foreground uppercase font-semibold">
            of {ALL_PAGES.length} pages
          </p>
        </div>
      </div>

      {/* Authorization editor */}
      <div className="bg-card border border-border rounded-xl shadow-sm-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="font-bold text-foreground">Tab Page Access Permissions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toggle navigation modules this designer/associate is authorized to view
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAll(true)}>
              Select all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAll(false)}>
              Clear all
            </Button>
            <Button
              size="sm"
              disabled={saving || !dirty}
              onClick={handleSave}
              className={cn(
                saved && "bg-emerald-600 text-white hover:bg-emerald-600/90 shadow-sm-soft"
              )}
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {ALL_PAGES.map((page) => {
            const enabled = access.has(page.key);
            return (
              <button
                key={page.key}
                onClick={() => toggle(page.key)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 select-none",
                  enabled
                    ? "border-primary/40 bg-primary/5 text-foreground shadow-sm-soft"
                    : "border-border bg-muted/10 text-muted-foreground hover:bg-muted/30"
                )}
              >
                <span
                  className={cn(
                    "w-9 h-5 rounded-full shrink-0 relative transition-colors duration-200",
                    enabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      enabled ? "translate-x-[1.125rem]" : "translate-x-0.5"
                    )}
                  />
                </span>
                <span className="text-sm font-semibold">{page.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const userRawData = useMasterData<User>("users");
  const authRawData = useMasterData<Authorization>("authorizations");

  const users: User[] = useMemo(
    () => (Array.isArray(userRawData.data) ? userRawData.data : []),
    [userRawData.data]
  );

  const authorizations: Authorization[] = useMemo(
    () => (Array.isArray(authRawData.data) ? authRawData.data : []),
    [authRawData.data]
  );

  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const detailUser = users.find((u) => u.id === detailUserId) ?? null;

  const handleSaveAuth = async (
    userId: string,
    nextAccess: Set<string>,
    _existingRecords: Authorization[]
  ) => {
    await authRawData.createAsync({
      userId,
      access: Array.from(nextAccess),
    } as any);
  };

  const handleEditSave = async (data: Partial<User>) => {
    if (!editingUser) return;
    await userRawData.update({ id: editingUser.id, data });
  };

  const handleDelete = async (userId: string) => {
    await userRawData.remove(userId);
    setDeletingUserId(null);
    if (detailUserId === userId) setDetailUserId(null);
  };

  const content = () => {
    if (detailUser) {
      return (
        <UserDetailPage
          user={detailUser}
          userAuthorizations={authorizations.filter((a) => a.userId === detailUser.id)}
          onBack={() => setDetailUserId(null)}
          onSaveAuth={handleSaveAuth}
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl shadow-sm-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-bold text-lg text-foreground">User Management</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click user rows to modify role-based page permission schemes
              </p>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none border-b border-border">
                  <th className="px-6 py-3.5 text-left">Username</th>
                  <th className="px-6 py-3.5 text-left">Email</th>
                  <th className="px-6 py-3.5 text-left">Role</th>
                  <th className="px-6 py-3.5 text-left">Page Count</th>
                  <th className="px-6 py-3.5 text-left">Allowed Modules</th>
                  <th className="px-6 py-3.5 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {userRawData.isLoading || authRawData.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Loading user list...
                      </span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const userAuths = authorizations.filter((a) => a.userId === user.id);
                    const granted = collectAccess(userAuths);
                    const isDeleting = deletingUserId === user.id;

                    return (
                      <tr
                        key={user.id}
                        onClick={() => setDetailUserId(user.id)}
                        className="hover:bg-muted/30 cursor-pointer transition-colors duration-200"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {getInitials(user.username)}
                            </div>
                            <span className="font-semibold text-foreground">{user.username}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-muted-foreground">{user.email}</td>

                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full uppercase">
                            {user.role || "USER"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary">
                            {granted.size} / {ALL_PAGES.length}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {granted.size === 0 ? (
                              <span className="text-xs text-muted-foreground font-semibold">None</span>
                            ) : (
                              ALL_PAGES.filter((p) => granted.has(p.key)).map((p) => (
                                <span
                                  key={p.key}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase"
                                >
                                  {p.label}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          {isDeleting ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-semibold text-destructive">Delete?</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleDelete(user.id)}
                              >
                                Yes
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDeletingUserId(null)}
                              >
                                No
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                onClick={() => setEditingUser(user)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletingUserId(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground select-none">System Settings</h1>
          <p className="text-sm text-muted-foreground">Manage accounts and role settings</p>
        </div>
        {content()}
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSave={handleEditSave}
          onClose={() => setEditingUser(null)}
        />
      )}
    </DashboardLayout>
  );
}
