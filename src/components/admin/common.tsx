import Link from "next/link";
import type { ReactNode } from "react";

export type AdminSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function AdminNotice({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const success = typeof query.success === "string" ? query.success : "";
  if (!error && !success) return null;
  return (
    <div
      className={`notice ${error ? "notice-error" : "notice-success"}`}
      role={error ? "alert" : "status"}
    >
      {error || success}
    </div>
  );
}

export function AdminHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="admin-heading">
      <div>
        <p className="eyebrow">{eyebrow || "Din verksamhet"}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function ReturnTo({ path }: { path: string }) {
  return <input type="hidden" name="returnTo" value={path} />;
}

export function EmptyState({
  title,
  children,
  href,
  label,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{children}</p>
      {href && label ? (
        <Link href={href} className="button button-secondary">
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
    </div>
  );
}

export function Field({
  label,
  name,
  children,
  help,
}: {
  label: string;
  name: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {help ? <small className="muted">{help}</small> : null}
    </div>
  );
}

export function kronor(ore: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(ore / 100);
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

export function dateOnly(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeZone: "Europe/Stockholm",
  }).format(new Date(value));
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    confirmed: "Bekräftad",
    pending: "Väntar på betalning",
    cancelled: "Avbokad",
    completed: "Genomförd",
    paid: "Betald",
    refunded: "Återbetald",
    failed: "Misslyckad",
    onsite: "På plats",
    stripe: "Kort via Stripe",
  };
  const green = ["confirmed", "completed", "paid"].includes(status);
  return (
    <span
      className={`badge ${green ? "badge-green" : status === "pending" ? "badge-amber" : ""}`}
    >
      {labels[status] || status}
    </span>
  );
}
