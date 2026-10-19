import { Link } from "react-router-dom";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function Forbidden() {
  const { user } = useAuth();

  const homePath =
    user?.role === "ADMIN"
      ? "/admin/dashboard"
      : user?.role === "NOTARY"
        ? "/notary/dashboard"
        : user
          ? "/dashboard"
          : "/";

  return (
    <PageContainer className="flex flex-col items-start gap-6 pt-16 md:pt-24">
      <span className="brut-border shadow-hard-sm inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase">
        Error 403
      </span>
      <h1 className="text-5xl leading-tight font-extrabold md:text-6xl">
        Access denied
      </h1>
      <Alert variant="error" className="max-w-xl">
        <AlertTitle>You do not have permission to view this page.</AlertTitle>
        <AlertDescription>
          Sign in with an account that has the required role.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to={homePath}>
            {user ? "Go to your dashboard" : "Return home"}
          </Link>
        </Button>
        {user && (
          <Button asChild variant="outline" size="lg">
            <Link to="/login">Sign in with different account</Link>
          </Button>
        )}
      </div>
    </PageContainer>
  );
}
