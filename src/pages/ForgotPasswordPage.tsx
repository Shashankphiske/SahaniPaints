import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { apiRequest } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await apiRequest.execute(`/users/forget/${encodeURIComponent(email)}`, {
        method: "GET",
      });
      toast({
        title: "Email sent",
        description: "Forgot password email sent. Please check your inbox.",
      });
      navigate("/login", { replace: true });
    } catch (err: any) {
      toast({
        title: "Request failed",
        description: err?.message ?? "Could not send forgot password email.",
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
            <CardTitle className="text-2xl font-bold font-display tracking-tight text-foreground">Forgot Password</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 transition-opacity mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </Button>
            <div className="text-center pt-2">
              <Link to="/login" className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
