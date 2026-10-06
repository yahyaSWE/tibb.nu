"use client";

import { NavigationLink as Link } from "@/components/navigation-link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass } from "lucide-react";

export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="portal-nav" aria-label="Elevportal">
      <Link
        href="/elevportal"
        intentOnly
        className={pathname.startsWith("/elevportal") ? "active" : ""}
        aria-current={pathname.startsWith("/elevportal") ? "page" : undefined}
      >
        <BookOpen size={17} /> Mina kurser
      </Link>
      <Link href="/kurser" intentOnly>
        <Compass size={17} /> Utforska kurser
      </Link>
    </nav>
  );
}
