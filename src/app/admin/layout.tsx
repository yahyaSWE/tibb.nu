import Link from "next/link";
import { ArrowUpRight, Leaf, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import "@/components/admin/admin.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administration · Tibb.nu",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <Leaf size={30} aria-hidden="true" />
          <span>
            Tibb<span className="brand-dot">.nu</span>
            <small>ADMINISTRATION</small>
          </span>
        </Link>
        <AdminNav />
        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-nav-link">
            <ArrowUpRight size={18} aria-hidden="true" />
            Visa hemsidan
          </Link>
          <div className="admin-user">
            <span className="avatar-initial">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>Administratör</small>
            </span>
          </div>
          <form action={logoutAction}>
            <button className="admin-nav-link" type="submit">
              <LogOut size={18} aria-hidden="true" />
              Logga ut
            </button>
          </form>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
