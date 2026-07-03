import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface LogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogoutDialog({ open, onOpenChange }: LogoutDialogProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [scope, setScope] = useState<"this" | "all">("this");
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout(scope === "all");
      toast({ title: "Logged out", description: scope === "all" ? "Signed out from all devices." : "Signed out." });
      onOpenChange(false);
      navigate("/login", { replace: true });
    } catch {
      toast({ title: "Logout failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign out</DialogTitle>
          <DialogDescription>Choose where you want to sign out.</DialogDescription>
        </DialogHeader>

        <RadioGroup value={scope} onValueChange={(v) => setScope(v as "this" | "all")} className="space-y-2 py-2">
          <div className="flex items-center space-x-2 rounded-md border border-border p-3">
            <RadioGroupItem value="this" id="this" />
            <Label htmlFor="this" className="flex-1 cursor-pointer">This device only</Label>
          </div>
          <div className="flex items-center space-x-2 rounded-md border border-border p-3">
            <RadioGroupItem value="all" id="all" />
            <Label htmlFor="all" className="flex-1 cursor-pointer">All devices</Label>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={handleLogout} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
