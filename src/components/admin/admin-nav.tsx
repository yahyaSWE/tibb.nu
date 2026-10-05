"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  LayoutDashboard,
  Settings2,
  Sprout,
  Users,
} from "lucide-react";

const links = [
  { href: "/admin", label: "Översikt", icon: LayoutDashboard },
  { href: "/admin/bokningar", label: "Bokningar", icon: CalendarDays },
  { href: "/admin/behandlingar", label: "Behandlingar", icon: Sprout },
  { href: "/admin/tider", label: "Tillgängliga tider", icon: Clock3 },
  { href: "/admin/artiklar", label: "Artiklar", icon: FileText },
  { href: "/admin/kurser", label: "Kurser", icon: BookOpen },
  { href: "/admin/elever", label: "Elever", icon: Users },
  { href: "/admin/installningar", label: "Inställningar", icon: Settings2 },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Administration">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`admin-nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
