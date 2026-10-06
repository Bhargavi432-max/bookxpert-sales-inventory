import clsx from "clsx";
import { Boxes, ClipboardCheck, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingCart, UserCog, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { approvalsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/orders", label: "Sales orders", icon: ShoppingCart },
  { to: "/approvals", label: "Approvals", icon: ClipboardCheck, managerOnly: true },
  { to: "/products", label: "Products", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/inventory", label: "Inventory log", icon: Boxes },
  { to: "/users", label: "Users", icon: UserCog, managerOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, managerOnly: true },
];

export function Layout() {
  const { user, isManager, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pending = useQuery({
    queryKey: ["approvals", "pending-count"],
    queryFn: () => approvalsApi.list({ status: "PENDING", page: 1 }),
    enabled: isManager,
    refetchInterval: 30_000,
  });

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">BX</div>
        <div>
          <p className="text-sm font-semibold text-white">BookXpert</p>
          <p className="text-xs text-slate-400">Sales & Inventory</p>
        </div>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {links
          .filter((link) => !link.managerOnly || isManager)
          .map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{label}</span>
                {to === "/approvals" && !!pending.data?.total && (
                  <span className="rounded-full bg-amber-400 px-2 text-xs font-semibold text-amber-950">{pending.data.total}</span>
                )}
              </NavLink>
            </li>
          ))}
      </ul>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-400">
          {user?.email} · {isManager ? "Manager" : "Sales"}
        </p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900">
            <button className="absolute right-3 top-5 text-slate-300" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-semibold">BookXpert</span>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
