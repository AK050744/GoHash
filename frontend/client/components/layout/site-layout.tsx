import { Outlet } from "react-router-dom";

import { SiteNav, type AppRole } from "@/components/layout/site-nav";

interface LayoutShellProps {
  role?: AppRole;
}

function LayoutShell({ role }: LayoutShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteNav role={role} />
      <main className="relative flex flex-1 flex-col pb-16">
        <Outlet />
      </main>
    </div>
  );
}

function PublicLayout() {
  return <LayoutShell />;
}

export interface AppLayoutProps {
  role: AppRole;
}

function AppLayout({ role }: AppLayoutProps) {
  return <LayoutShell role={role} />;
}

export { AppLayout, PublicLayout };
