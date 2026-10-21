import { requireAdmin } from "@/lib/auth";
import { getFormulaCatalog, getFormulaCatalogStock } from "@/lib/anamnes/catalog";
import { therapistAccess } from "@/lib/anamnes/cases";
import { getAdminShopProducts } from "@/lib/shop";
import { AdminHeading } from "@/components/admin/common";
import { AnamnesAdminNav } from "@/components/admin/anamnes-nav";
import { AnamnesFormulaEditor, DeleteAnamnesFormula } from "@/components/admin/anamnes-formula-editor";
import { AnamnesCatalogStockList } from "@/components/admin/anamnes-therapist-overview";
import { AnamnesReferenceLibrary } from "@/components/admin/anamnes-reference-library";
import { specialOrderDraft } from "@/lib/anamnes/special-order-catalog";

export default async function AnamnesFormulasPage({searchParams}:{searchParams:Promise<{reference?:string;bookSearch?:string}>}) {
  const actor = await requireAdmin();
  const query=await searchParams;
  const [formulas, products, stock] = await Promise.all([getFormulaCatalog(), getAdminShopProducts(actor.id), getFormulaCatalogStock(actor)]);
  const choices = products.filter(product => product.kind !== "bundle").map(product => ({ id: product.id, name: product.name, published: product.published }));
  const draft=query.reference && !formulas.some(formula => formula.id===query.reference) ? specialOrderDraft(query.reference) : null;
  return <>
    <AdminHeading title="Formelkatalog" description="Styr vilka formler som får jämföras med ett oberoende TCM-resultat. Ändringar gäller nya analyser och ändrar inte redan sparade rapporter." />
    <AnamnesAdminNav current="formulas" therapist={therapistAccess(actor)} />
    <p className="notice">Det aktiva sortimentet utgår från China Natures tio leverantörsprodukter. Produktidentitet, innehåll, säkerhet och regulatorisk status är overifierade tills faktisk dokumentation har granskats. En aktiv klassisk referens är inte en produktrekommendation.</p>
    <AnamnesCatalogStockList stock={stock.filter(item => formulas.find(formula => formula.id===item.id)?.referenceKind!=='special_order')} formulaNames={Object.fromEntries(formulas.map(formula => [formula.id, formula.name]))} />
    <p className="muted">Specialbeställningar är dokumentreferenser inför rådgivning och visas separat från ordinarie lagerprodukter.</p>
    <div className="anamnes-admin-list">{formulas.map(formula => <details id={`formula-${formula.id}`} open={query.reference===formula.id} className="panel lesson-card" key={`${formula.id}-${formula.updatedAt}`}><summary><strong>{formula.name}{formula.pinyin && formula.pinyin !== formula.name && <small className="anamnes-formula-classical">{formula.pinyin}</small>}</strong><span className={`badge${formula.active ? " badge-green" : ""}`}>{formula.active ? "Aktiv referens" : "Inaktiv"}</span>{formula.referenceKind==='special_order' && <span className="badge">Specialbeställning via rådgivning</span>}{formula.requiresVerification && <span className="badge anamnes-badge-review">Ingrediensuppgifter behöver kontrolleras</span>}<span className="badge">{formula.productIdentityVerified && formula.ingredientsVerified && formula.safetyVerified && formula.regulatoryVerified && !formula.requiresVerification ? "Verifieringsmarkeringar ifyllda" : "Produktverifiering saknas"}</span><span className="muted">Redigera</span></summary><div className="lesson-editor"><AnamnesFormulaEditor formula={formula} products={choices} /><DeleteAnamnesFormula id={formula.id} updatedAt={formula.updatedAt} /></div></details>)}</div>
    <AnamnesReferenceLibrary search={query.bookSearch} existingIds={formulas.map(formula => formula.id)} />
    <section id="new-reference" className="panel" style={{ marginTop: 24 }}><h2>{draft ? `Förbered ${draft.name}` : 'Lägg till en formel'}</h2><p className="muted">En ny formel är inaktiv tills du väljer att aktivera den. Du kan utöka sortimentet här utan att ändra AI-koden. Nya TCM-mönster kräver däremot en granskad utökning av mönstermodellen.</p><AnamnesFormulaEditor key={`new-${formulas.length}-${draft?.id ?? ''}`} draft={draft ?? undefined} products={choices} /></section>
  </>;
}
