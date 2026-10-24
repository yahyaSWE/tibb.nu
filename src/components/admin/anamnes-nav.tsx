import Link from "next/link";

export function AnamnesAdminNav({ current, therapist }: { current: "overview" | "formulas" | "cases" | "quality"; therapist: boolean }) {
  return <nav className="anamnes-admin-tabs" aria-label="Anamnesadministration">
    <Link href="/admin/anamnes" aria-current={current === "overview" ? "page" : undefined}>Översikt och driftsättning</Link>
    <Link href="/admin/anamnes/formler" aria-current={current === "formulas" ? "page" : undefined}>Formelkatalog</Link>
    {therapist && <Link href="/admin/anamnes/arenden" aria-current={current === "cases" ? "page" : undefined}>Inskickade anamneser</Link>}
    {therapist && <Link href="/admin/anamnes/kvalitet" aria-current={current === "quality" ? "page" : undefined}>Kvalitetsfall och egen granskning</Link>}
    {therapist && <Link href="/admin/inskickade-underlag">Alla inskickade underlag</Link>}
  </nav>;
}
