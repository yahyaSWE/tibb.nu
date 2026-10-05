"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass } from "lucide-react";

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="portal-nav" aria-label="Elevportal">
      <Link
        href="/elevportal"
        className={pathname.startsWith("/elevportal") ? "active" : ""}
      >
        <BookOpen size={17} /> Mina kurser
      </Link>
      <Link href="/kurser">
        <Compass size={17} /> Utforska kurser
      </Link>
    </nav>
  );
}
