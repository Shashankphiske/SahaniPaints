import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAccessKeyForPath } from "../../lib/access";
import type { Role } from "../../types/master";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  accessKey?: string;
}

export function ProtectedRoute({ children, roles, accessKey }: ProtectedRouteProps) {
  const { user, isLoading, hasAccess } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user?.id) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <AccessDenied />;
  }

  const key = accessKey ?? getAccessKeyForPath(location.pathname);
  if (key && !hasAccess(key)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-background text-center px-6">
      <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        You don't have permission to view this page. Please contact your administrator.
      </p>
      <a href="/" className="text-primary underline hover:text-primary/90">
        Return to Home
      </a>
    </div>
  );
}
