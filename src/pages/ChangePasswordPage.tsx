import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { apiRequest } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ChangePasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: "Invalid link", description: "Reset token is missing.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest.execute(`/users/${token}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      });
      toast({ title: "Password changed", description: "You can now sign in with your new password." });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({
        title: "Could not change password",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4 relative overflow-hidden select-none">
      <div className="absolute top-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-accent/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[35rem] h-[35rem] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md relative shadow-elegant border border-border/80 bg-card/65 backdrop-blur-md animate-scale-in">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg shadow-md-soft">
            SP
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold font-display tracking-tight text-foreground">Change Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 transition-opacity mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
