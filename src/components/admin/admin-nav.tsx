"use client";

import { NavigationLink as Link } from "@/components/navigation-link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Package,
  Settings2,
  ShoppingBag,
  Sprout,
  Stethoscope,
  Store,
  TicketPercent,
  Truck,
  Users,
} from "lucide-react";

const categories = [
  {
    id: "mottagning", label: "Mottagning", icon: Stethoscope,
    links: [
      { href: "/admin/bokningar", label: "Bokningar", icon: CalendarDays },
      { href: "/admin/tider", label: "Tillgängliga tider", icon: Clock3 },
      { href: "/admin/behandlingar", label: "Behandlingar", icon: Sprout },
      { href: "/admin/behandlare", label: "Behandlare", icon: Users },
      { href: "/admin/inskickade-underlag", label: "Inskickade underlag", icon: FileText },
      { href: "/admin/anamnes", label: "Anamnes", icon: Stethoscope },
    ],
  },
  {
    id: "forsaljning", label: "Försäljning", icon: ShoppingBag,
    links: [
      { href: "/admin/bestallningar", label: "Beställningar", icon: ShoppingBag },
      { href: "/admin/friskvard", label: "Friskvård", icon: TicketPercent },
      { href: "/admin/produkter", label: "Produkter", icon: Package },
      { href: "/admin/rabatter", label: "Rabatter", icon: TicketPercent },
      { href: "/admin/frakt", label: "Frakt", icon: Truck },
      { href: "/admin/butik", label: "Butiksinställningar", icon: Store },
    ],
  },
  {
    id: "utbildning", label: "Utbildning", icon: GraduationCap,
    links: [
      { href: "/admin/kurser", label: "Kurser", icon: BookOpen },
      { href: "/admin/elever", label: "Elever", icon: Users },
      { href: "/admin/grupper", label: "Grupper", icon: Users },
      { href: "/admin/medlemskap", label: "Medlemskap", icon: TicketPercent },
    ],
  },
  {
    id: "webbplats", label: "Webbplats", icon: FileText,
    links: [
      { href: "/admin/artiklar", label: "Artiklar", icon: FileText },
      { href: "/admin/installningar", label: "Inställningar", icon: Settings2 },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  return <AdminNavForPage key={pathname} pathname={pathname} />;
}

function AdminNavForPage({ pathname }: { pathname: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selection, setSelection] = useState<string | null>();
  const toggle = useRef<HTMLButtonElement>(null);
  const overview = pathname === "/admin";
  const inCurrentPage = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const currentCategory = categories.find(({ links }) => links.some(({ href }) => inCurrentPage(href)));
  const currentPage = currentCategory?.links.find(({ href }) => inCurrentPage(href));
  const expandedCategory = selection === undefined ? currentCategory?.id : selection;

  return (
    <nav className="admin-nav" aria-label="Administration" onKeyDown={event => {
      if (event.key === "Escape" && mobileOpen && toggle.current?.getClientRects().length) {
        setMobileOpen(false);
        toggle.current.focus();
      }
    }}>
      <button ref={toggle} type="button" className="admin-nav-toggle" aria-expanded={mobileOpen}
        aria-controls="admin-nav-sections" onClick={() => setMobileOpen(open => !open)}>
        <span><strong>Meny</strong> · {currentPage?.label ?? "Översikt"}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id="admin-nav-sections" className="admin-nav-sections" data-expanded={mobileOpen}>
        <Link href="/admin" intentOnly className={`admin-nav-link${overview ? " active" : ""}`}
          aria-current={overview ? "page" : undefined} onNavigate={() => setMobileOpen(false)}>
          <LayoutDashboard size={18} aria-hidden="true" />
          Översikt
        </Link>
        {categories.map(({ id, label, icon: Icon, links }) => {
          const expanded = expandedCategory === id;
          const listId = "admin-nav-" + id;
          return (
            <div className="admin-nav-section" key={id}>
              <button type="button" className="admin-nav-category" data-current={currentCategory?.id === id}
                aria-controls={listId} aria-expanded={expanded}
                onClick={() => setSelection(expanded ? null : id)}>
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                <ChevronDown className="admin-nav-chevron" size={16} aria-hidden="true" />
              </button>
              <ul hidden={!expanded} id={listId}>
                {links.map(({ href, label, icon: LinkIcon }) => {
                  const active = currentPage?.href === href;
                  return (
                    <li key={href}>
                      <Link href={href} intentOnly className={`admin-nav-link${active ? " active" : ""}`}
                        aria-current={active ? (href === pathname ? "page" : "location") : undefined}
                        onNavigate={() => setMobileOpen(false)}>
                        <LinkIcon size={16} aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
