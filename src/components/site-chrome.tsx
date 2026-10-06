"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Leaf, Menu, UserRound, X } from "lucide-react";

export function OliveMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 46 46"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 37C22 27 25 15 35 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 28C12 29 8 24 8 18c8 0 13 3 12 10ZM25 20C17 22 14 17 15 11c7 0 12 3 10 9ZM30 14c-5-6-2-11 3-13 4 5 4 10-3 13ZM22 26c8-1 13 2 13 8-8 1-12-2-13-8ZM28 17c8-2 13 0 14 6-7 3-12 1-14-6Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SiteChrome({
  children,
  siteName,
  contactEmail,
  user,
}: {
  children: React.ReactNode;
  siteName: string;
  contactEmail: string;
  user: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/admin") || pathname.startsWith("/elevportal"))
    return <>{children}</>;
  const nav = [
    { href: "/", label: "Startsida" },
    { href: "/boka", label: "Behandlingar & bokning" },
    { href: "/kurser", label: "Kurser" },
    { href: "/artiklar", label: "Artiklar" },
    { href: "/om", label: "Om Tibb" },
  ];
  const brandName = siteName.endsWith(".nu") ? siteName.slice(0, -3) : siteName;
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Hoppa till innehållet
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link
            href="/"
            className="brand"
            aria-label={`${siteName}, startsida`}
            onClick={() => setOpen(false)}
          >
            <OliveMark />
            <span>
              {brandName}
              {siteName.endsWith(".nu") && (
                <span className="brand-domain">.nu</span>
              )}
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Huvudmeny">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                    ? "active"
                    : ""
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            className="portal-link"
            href={
              user?.role === "admin"
                ? "/admin"
                : user
                  ? "/elevportal"
                  : "/logga-in"
            }
          >
            <UserRound size={16} />
            <span>{user?.role === "admin" ? "Admin" : "Elevportal"}</span>
          </Link>
          <button
            type="button"
            className="mobile-toggle"
            aria-label={open ? "Stäng menyn" : "Öppna menyn"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav id="mobile-menu" className="mobile-menu" aria-label="Mobilmeny">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main
        id="main-content"
        className={pathname === "/" ? "public-main" : "public-main inner-page"}
      >
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <Link href="/" className="brand">
              <OliveMark />
              <span>{siteName}</span>
            </Link>
            <p>
              Klassisk kinesisk medicin i ljuset
              <br />
              av den Profetiska vägledningen.
            </p>
          </div>
          <div>
            <span className="footer-label">Upptäck</span>
            <Link href="/boka">Boka en behandling</Link>
            <Link href="/kurser">Våra kurser</Link>
            <Link href="/artiklar">Kunskap & artiklar</Link>
          </div>
          <div>
            <span className="footer-label">Välkommen</span>
            <Link href="/om">Om Tibb.nu</Link>
            <Link href="/elevportal">
              Elevportalen <ArrowUpRight size={13} />
            </Link>
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            ) : (
              <Link href="/kontakt">Kontakta oss</Link>
            )}
          </div>
          <div className="footer-note">
            <Leaf size={24} strokeWidth={1.2} />
            <p>
              Traditionell kinesisk medicin i ljuset av profetisk medicin
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {siteName}
          </span>
          <Link href="/integritet">Integritet</Link>
          <Link href="/admin">Administration</Link>
        </div>
      </footer>
    </div>
  );
}
