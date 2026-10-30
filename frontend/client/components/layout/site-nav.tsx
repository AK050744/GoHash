import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LogOut, Menu, X } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { WalletPill } from "@/components/layout/wallet-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export type AppRole = "USER" | "NOTARY" | "ADMIN";

interface NavItem {
  to: string;
  label: string;
}

const roleNavItems: Record<AppRole, NavItem[]> = {
  USER: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/upload", label: "Upload" },
    { to: "/my-documents", label: "My Documents" },
    { to: "/verify", label: "Verify" },
    { to: "/profile", label: "Profile" },
  ],
  NOTARY: [
    { to: "/notary/dashboard", label: "Requests" },
    { to: "/verify", label: "Verify" },
    { to: "/profile", label: "Profile" },
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard" },
    { to: "/admin/notaries", label: "Notaries" },
    { to: "/verify", label: "Verify" },
    { to: "/profile", label: "Profile" },
  ],
};

const publicNavItems: NavItem[] = [{ to: "/verify", label: "Verify" }];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-9 md:min-h-10 items-center rounded-full border-[2px] lg:border-[2.5px] px-2.5 lg:px-3 text-xs lg:text-sm font-bold whitespace-nowrap text-navy transition-colors duration-150",
    isActive ? "border-navy bg-yellow" : "border-transparent hover:bg-cream",
  );

interface AccountActionsProps {
  role?: AppRole;
  onNavigate?: () => void;
}

function AccountActions({ role, onNavigate }: AccountActionsProps) {
  const { user, logout } = useAuth();
  const effectiveRole = role ?? (user?.role as AppRole | undefined);

  const handleLogout = () => {
    logout();
    if (onNavigate) onNavigate();
    window.location.href = "/login";
  };

  if (effectiveRole) {
    return (
      <>
        <WalletPill />
        <Badge variant="teal" className="hidden sm:inline-flex">{effectiveRole}</Badge>
        <Button variant="outline" size="sm" icon={<LogOut />} onClick={handleLogout}>
          Logout
        </Button>
      </>
    );
  }
  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link to="/login" onClick={onNavigate}>
          Login
        </Link>
      </Button>
      <Button asChild variant="primary" size="sm">
        <Link to="/register" onClick={onNavigate}>
          Register
        </Link>
      </Button>
    </>
  );
}

export interface SiteNavProps {
  role?: AppRole;
}

function SiteNav({ role }: SiteNavProps) {
  const { user } = useAuth();
  const effectiveRole = role ?? (user?.role as AppRole | undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = effectiveRole ? roleNavItems[effectiveRole] : publicNavItems;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 px-3 md:px-4 pt-3 md:pt-4 print:hidden">
      <div className="brut-border shadow-hard-sm mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-2 md:gap-3 rounded-full bg-white py-1.5 md:py-2 pr-2 pl-3 md:pl-4">
        <Link
          to="/"
          aria-label="GoHash home"
          className="flex min-h-10 md:min-h-11 items-center gap-2 rounded-full shrink-0"
        >
          <BrandMark />
          <span className="text-lg md:text-xl font-extrabold tracking-tight text-navy">
            Go
            <span className="ml-0.5 rounded-lg bg-navy px-1.5 text-yellow">
              Hash
            </span>
          </span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-0.5 lg:gap-1 md:flex"
        >
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-1.5 lg:gap-2 md:flex">
          <AccountActions role={effectiveRole} />
        </div>

        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open menu"
              className="md:hidden"
            >
              <Menu aria-hidden="true" />
            </Button>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/50 md:hidden" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="brut-border shadow-hard fixed inset-x-4 top-4 z-50 flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-y-auto rounded-card bg-white p-4 md:hidden"
            >
              <div className="flex items-center justify-between gap-3">
                <DialogPrimitive.Title className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-navy">
                  <BrandMark />
                  Go
                  <span className="rounded-lg bg-navy px-1.5 text-yellow">
                    Hash
                  </span>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className="brut-border brut-raise flex size-11 items-center justify-center rounded-full bg-white"
                >
                  <X className="size-5" aria-hidden="true" />
                </DialogPrimitive.Close>
              </div>

              <nav aria-label="Main mobile" className="flex flex-col gap-2">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    className={(state) =>
                      cn(navLinkClass(state), "justify-start text-base")
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex flex-col gap-3 border-t-[2.5px] border-navy pt-5">
                <AccountActions role={effectiveRole} onNavigate={closeMenu} />
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </header>
  );
}

export { SiteNav };
