import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAnamnesConfigStatus } from "@/lib/anamnes/config";
import { listAnamnesCases, therapistAccess } from "@/lib/anamnes/cases";
import { AdminHeading, dateTime, EmptyState } from "@/components/admin/common";
import { AnamnesAdminNav } from "@/components/admin/anamnes-nav";

export default async function AnamnesCasesPage() {
  const actor = await requireAdmin();
  const allowed = therapistAccess(actor);
  const status = getAnamnesConfigStatus();
  // Authorize before querying any case metadata or decrypting health records.
  if (!allowed) return <><AdminHeading title="Inskickade anamneser" description="Den här vyn kräver särskild behandlarbehörighet utöver administratörskontot." /><AnamnesAdminNav current="cases" therapist={false} /><p className="notice">Ditt konto saknar behörighet. Behöriga administratörers e-postadresser konfigureras i ANAMNES_THERAPIST_EMAILS på servern.</p></>;
  if (!status.submissions.storageReady) return <><AdminHeading title="Inskickade anamneser" description="Säker lagring är inte färdigkonfigurerad." /><AnamnesAdminNav current="cases" therapist /><p className="notice">ANAMNES_STORAGE_KEY saknas eller har fel format. Ingen anamnes öppnas. Se <Link href="/admin/anamnes">driftsättningsöversikten</Link>.</p></>;
  const cases = await listAnamnesCases(actor);
  return <><AdminHeading title="Inskickade anamneser" description="Endast separat inskickade underlag visas här. Fullständiga svar, kontaktuppgifter och behandlarnoteringar öppnas först i det skyddade ärendet." /><AnamnesAdminNav current="cases" therapist />
    {!status.submissions.available && <p className="notice">Nya inskick är avstängda. Befintliga ärenden kan fortfarande granskas och raderas tills lagringstiden löper ut.</p>}
    <section className="panel">{cases.length ? <div className="table-wrap"><table className="admin-table"><thead><tr><th>Inskickad</th><th>Raderas tidigast vid nästa rensning efter</th><th>Behandlarbedömning</th><th>Öppna</th></tr></thead><tbody>{cases.map((item, index) => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td>{dateTime(item.expiresAt)}</td><td>{item.revision > 0 ? `${item.revision} sparade anteckningar` : "Ej bedömd"}</td><td><Link href={`/admin/anamnes/arenden/${item.id}`} className="text-link" aria-label={`Öppna anamnes ${index + 1}, inskickad ${dateTime(item.createdAt)}`}>Öppna ärende</Link></td></tr>)}</tbody></table></div> : <EmptyState title="Inga aktuella anamneser">När en besökare uttryckligen väljer att skicka sitt underlag visas ärendet här. Anamneser som endast visas i webbläsaren lagras inte automatiskt.</EmptyState>}</section>
  </>;
}
