import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <PageContainer className="flex flex-col items-start gap-6 pt-16 md:pt-24">
      <span className="brut-border shadow-hard-sm inline-flex rounded-full bg-yellow px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase">
        Error 404
      </span>
      <h1 className="text-5xl leading-tight font-extrabold md:text-6xl">
        Page not found
      </h1>
      <p className="max-w-md text-lg font-medium text-slate">
        The page you requested does not exist or has moved.
      </p>
      <Button asChild size="lg">
        <Link to="/">Return home</Link>
      </Button>
    </PageContainer>
  );
};

export default NotFound;
