import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAnamnesConfigStatus } from "@/lib/anamnes/config";
import { therapistAccess } from "@/lib/anamnes/cases";
import { getFormulaCatalog } from "@/lib/anamnes/catalog";
import { AdminHeading } from "@/components/admin/common";
import { AnamnesAdminNav } from "@/components/admin/anamnes-nav";
import { AnamnesAnalysisSettings } from "@/components/admin/anamnes-analysis-settings";
import { getAnamnesAnalysisMode } from "@/lib/anamnes/settings";

export default async function AnamnesAdminOverview() {
  const actor = await requireAdmin();
  const status = getAnamnesConfigStatus();
  const therapist = therapistAccess(actor);
  const catalog = await getFormulaCatalog();
  const analysisMode = await getAnamnesAnalysisMode();
  return <>
    <AdminHeading title="Anamnes" description="Förvalta formelreferenser, kontrollera driftsättningen och granska anamneser med separat behandlarbehörighet." action={<Link href="/anamnes" className="button button-secondary">Öppna besökarvyn</Link>} />
    <AnamnesAdminNav current="overview" therapist={therapist} />
    <div className="anamnes-admin-grid">
      <AnamnesAnalysisSettings mode={analysisMode} aiConfigured={status.ai.available} />
      <section className="panel"><h2>Formelkatalog</h2><p>{catalog.filter(formula => formula.active).length} aktiva referenser av {catalog.length} formler. Mönsteranalysen görs oberoende av sortimentet. Högst tre relevanta referenser visas efteråt.</p><p className="muted">En formel kan vara aktiv som klassisk referens utan att vara en verifierad eller tillgänglig produkt. Leverantörens faktiska innehåll, säkerhet och regulatoriska status behöver kontrolleras separat.</p><Link className="text-link" href="/admin/anamnes/formler">Redigera formler och verifieringsunderlag</Link></section>
      <section className="panel"><h2>Behörighet till hälsouppgifter</h2><p>{therapist ? "Ditt administratörskonto har särskild behandlarbehörighet." : "Ditt administratörskonto kan hantera katalogen men har inte behörighet att läsa inskickade anamneser."}</p><p className="muted">Behandlare måste både vara administratörer och uttryckligen finnas i ANAMNES_THERAPIST_EMAILS. Listan är tom som standard. Ändras via serverns miljövariabler.</p>{therapist && <Link className="text-link" href="/admin/anamnes/arenden">Öppna inskickade anamneser</Link>}</section>
      <section className="panel"><div className="anamnes-admin-status"><h2>AI-konfiguration</h2><span className={`badge${status.ai.available ? " badge-green" : ""}`}>{status.ai.available ? "Tekniskt klar" : "Konfiguration saknas"}</span></div><p>{status.ai.providerLabel}</p><p>Valt läge: <strong>{analysisMode === "ai" ? "AI-assisterad anamnes" : "Poängbaserad anamnes"}</strong>. {analysisMode === "rules" ? "Ingen ny AI-analys begärs, även om AI är konfigurerad." : !status.ai.available ? "Poänganalysen används tills AI-konfigurationen är klar." : "AI kan användas efter besökarens samtycke."}</p><p>Gemensam gräns: högst {status.ai.dailyLimit} leverantörsförsök under en 24-timmarsperiod räknad från periodens första försök. Vid uppnådd gräns används regelmodellen.</p><p className="muted">Regelmodellen fungerar utan AI. AI får bara ta emot svar efter besökarens separata val och efter att verksamhetens rättsliga, kliniska och dataskyddsmässiga granskning är klar.</p>{status.ai.missing.length > 0 && <><p>Konfiguration som saknas för aktivering:</p><ul className="anamnes-admin-setup-list">{status.ai.missing.map(value => <li key={value}><code>{value}</code></li>)}</ul></>}</section>
      <section className="panel"><div className="anamnes-admin-status"><h2>Skicka till behandlare</h2><span className={`badge${status.submissions.available ? " badge-green" : ""}`}>{status.submissions.available ? "Tekniskt aktiverat" : "Avstängt"}</span></div><p>Konfigurerad lagringstid: {status.submissions.retentionDays} dagar. Inskickning kräver ett separat samtycke. Hälsouppgifter och behandlarnoteringar lagras krypterat.</p>{status.submissions.missing.length > 0 && <><p>Konfiguration som saknas för nya inskick:</p><ul className="anamnes-admin-setup-list">{status.submissions.missing.map(value => <li key={value}><code>{value}</code></li>)}</ul></>}<p className="muted">Utgångna ärenden spärras direkt och rensas vid ärendehantering. För schemalagd rensning även utan trafik finns instruktioner i driftsättningsguiden.</p></section>
      <section className="panel anamnes-admin-full"><h2>Granskning före aktivering</h2><p>Miljöflaggorna ANAMNES_PRIVACY_REVIEWED, ANAMNES_CLINICAL_REVIEWED och ANAMNES_REGULATORY_REVIEWED är tekniska spärrar. De utgör inte ett juridiskt godkännande eller en klinisk validering. Dokumentera rättslig grund, undantag för hälsouppgifter, personuppgiftsbiträden, konsekvensbedömning, information, säkerhetsrutiner och bedömningen av medicinteknisk mjukvara innan offentlig AI-behandling eller lagring aktiveras.</p><p className="muted">Detaljerade aktiveringssteg, miljövariabler och granskningspunkter finns i projektets docs/anamnes-v2-setup.md.</p></section>
    </div>
  </>;
}
