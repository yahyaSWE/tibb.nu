import Link from "next/link";

export function AnamnesAdminNav({ current, therapist }: { current: "overview" | "formulas" | "cases"; therapist: boolean }) {
  return <nav className="anamnes-admin-tabs" aria-label="Anamnesadministration">
    <Link href="/admin/anamnes" aria-current={current === "overview" ? "page" : undefined}>Översikt och driftsättning</Link>
    <Link href="/admin/anamnes/formler" aria-current={current === "formulas" ? "page" : undefined}>Formelkatalog</Link>
    {therapist && <Link href="/admin/anamnes/arenden" aria-current={current === "cases" ? "page" : undefined}>Inskickade anamneser</Link>}
  </nav>;
}
