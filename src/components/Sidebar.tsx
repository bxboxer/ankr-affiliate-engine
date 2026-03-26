"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  RiDashboardLine,
  RiGlobalLine,
  RiAddCircleLine,
  RiSpyLine,
  RiSettings3Line,
  RiLogoutBoxLine,
} from "react-icons/ri";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: RiDashboardLine },
  { href: "/sites", label: "Sites", icon: RiGlobalLine },
  { href: "/spawn", label: "Spawn Site", icon: RiAddCircleLine },
  { href: "/recon", label: "Recon Intel", icon: RiSpyLine },
  { href: "/settings", label: "Settings", icon: RiSettings3Line },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col bg-base-100 border-r border-base-300">
      <div className="flex h-16 items-center gap-2 border-b border-base-300 px-6">
        <span className="text-xl font-bold text-primary">AE</span>
        <span className="text-lg font-semibold">Affiliate Engine</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-base-content/70 hover:bg-base-200 hover:text-base-content"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-base-300 p-4">
        <Link
          href="/api/auth/logout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-base-content/70 hover:bg-base-200 hover:text-error"
        >
          <RiLogoutBoxLine className="h-5 w-5" />
          Logout
        </Link>
      </div>
    </aside>
  );
}
