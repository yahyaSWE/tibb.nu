import { requireAdmin } from "@/lib/auth";
import { getFormulaCatalog } from "@/lib/anamnes/catalog";
import { therapistAccess } from "@/lib/anamnes/cases";
import { getAdminShopProducts } from "@/lib/shop";
import { AdminHeading } from "@/components/admin/common";
import { AnamnesAdminNav } from "@/components/admin/anamnes-nav";
import { AnamnesFormulaEditor, DeleteAnamnesFormula } from "@/components/admin/anamnes-formula-editor";

export default async function AnamnesFormulasPage() {
  const actor = await requireAdmin();
  const [formulas, products] = await Promise.all([getFormulaCatalog(), getAdminShopProducts(actor.id)]);
  const choices = products.filter(product => product.kind !== "bundle").map(product => ({ id: product.id, name: product.name, published: product.published }));
  return <>
    <AdminHeading title="Formelkatalog" description="Styr vilka formler som får jämföras med ett oberoende TCM-resultat. Ändringar gäller nya analyser och ändrar inte redan sparade rapporter." />
    <AnamnesAdminNav current="formulas" therapist={therapistAccess(actor)} />
    <p className="notice">Katalogen börjar med ditt sortiment om tio formler. Produktidentitet, innehåll, säkerhet och regulatorisk status är overifierade tills faktisk dokumentation har granskats. En aktiv klassisk referens är inte en produktrekommendation.</p>
    <div className="anamnes-admin-list">{formulas.map(formula => <details className="panel lesson-card" key={`${formula.id}-${formula.updatedAt}`}><summary><strong>{formula.name}</strong><span className={`badge${formula.active ? " badge-green" : ""}`}>{formula.active ? "Aktiv referens" : "Inaktiv"}</span><span className="badge">{formula.productIdentityVerified && formula.ingredientsVerified && formula.safetyVerified && formula.regulatoryVerified ? "Verifieringsmarkeringar ifyllda" : "Produktverifiering saknas"}</span><span className="muted">Redigera</span></summary><div className="lesson-editor"><AnamnesFormulaEditor formula={formula} products={choices} /><DeleteAnamnesFormula id={formula.id} updatedAt={formula.updatedAt} /></div></details>)}</div>
    <section className="panel" style={{ marginTop: 24 }}><h2>Lägg till en formel</h2><p className="muted">En ny formel är inaktiv tills du väljer att aktivera den. Du kan utöka sortimentet här utan att ändra AI-koden. Nya TCM-mönster kräver däremot en granskad utökning av mönstermodellen.</p><AnamnesFormulaEditor key={`new-${formulas.length}`} products={choices} /></section>
  </>;
}
