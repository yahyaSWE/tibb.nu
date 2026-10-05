import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Leaf, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { PortalNav } from "@/components/learning/portal-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Elevportal",
  robots: { index: false, follow: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Link className="portal-brand" href="/elevportal">
          <Leaf size={25} strokeWidth={1.6} />
          <span>
            Tibb<span className="brand-dot">.</span>
            <small>Elevportal</small>
          </span>
        </Link>
        <div className="portal-header-actions">
          <Link href="/" className="back-link" aria-label="Till hemsidan">
            <ArrowLeft size={15} />
            <span>Till hemsidan</span>
          </Link>
          <span className="portal-user">{user.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="button button-secondary button-small"
              aria-label="Logga ut"
            >
              <LogOut size={15} />
              <span>Logga ut</span>
            </button>
          </form>
        </div>
      </header>
      <PortalNav />
      <main className="portal-main">{children}</main>
      <footer className="portal-footer">
        Tibb.nu · Kunskap med rötter. Omsorg med mening.
      </footer>
    </div>
  );
}
