import { Link } from "react-router-dom";

import { PageContainer } from "@/components/layout/page-container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
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
      <Button asChild size="lg">
        <Link to="/">Return home</Link>
      </Button>
    </PageContainer>
  );
}
