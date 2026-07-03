import { useState } from "react";
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { Role } from "../types/master";

interface LoginResponse {
  id: string;
  role: Role;
  auth?: any[];
  access?: any[];
  username?: string;
}

export default function LoginPage() {
  const { user, setUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname ?? "/";

  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setSubmitting(true);
    try {
      const data = await apiRequest.execute<LoginResponse>("/auth/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (data?.id && data?.role) {
        setUser({
          id: data.id,
          role: data.role,
          access: Array.isArray(data.auth) ? data.auth :
                  Array.isArray(data.access) ? data.access : [],
          username: data.username,
        });
        toast({ title: "Welcome back", description: "Logged in successfully." });
        navigate(from, { replace: true });
      } else {
        throw new Error("Invalid login response payload.");
      }
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err?.message ?? "Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4 relative overflow-hidden select-none">
      {/* Decorative background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-accent/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[35rem] h-[35rem] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md relative shadow-elegant border border-border/80 bg-card/65 backdrop-blur-md animate-scale-in">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-lg shadow-md-soft">
            SP
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold font-display tracking-tight text-foreground">Welcome back</CardTitle>
            <CardDescription>Sign in to your Sahani Paints dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                required
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 transition-opacity mt-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
            <div className="text-center pt-2">
              <Link to="/forgot-password" className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
