import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function Forbidden() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    requiredRoles?: string[];
    currentRole?: string;
    from?: string;
  } | null;

  const signedInRole = user?.role ?? state?.currentRole ?? "Not signed in";
  const requiredRoles = state?.requiredRoles?.length
    ? state.requiredRoles.join(", ")
    : "Authorized role";

  const dashboardPath =
    user?.role === "ADMIN"
      ? "/admin/dashboard"
      : user?.role === "NOTARY"
        ? "/notary/dashboard"
        : "/dashboard";

  const handleSwitchAccount = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <PageContainer className="flex flex-col items-start gap-6 pt-16 md:pt-24">
      <span className="brut-border shadow-hard-sm inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase">
        Error 403
      </span>
      <h1 className="text-5xl leading-tight font-extrabold md:text-6xl">
        Access denied
      </h1>

      <div className="brut-border shadow-hard-sm flex max-w-xl flex-col gap-4 rounded-card bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate">Signed-in role:</span>
          <Badge variant="teal">{signedInRole}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate">Required role(s):</span>
          <Badge variant="default">{requiredRoles}</Badge>
        </div>
      </div>

      <Alert variant="error" className="max-w-xl">
        <AlertTitle>You do not have permission to view this page.</AlertTitle>
        <AlertDescription>
          Sign in with an account that has the required role.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to={dashboardPath}>Go to my dashboard</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          icon={<LogOut className="size-4" />}
          onClick={handleSwitchAccount}
        >
          Switch account
        </Button>
      </div>
    </PageContainer>
  );
}
