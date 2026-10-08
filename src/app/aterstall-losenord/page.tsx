import Link from "next/link";
import { AccountForm } from "@/components/auth/account-forms";
import { PRIVATE_METADATA } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Återställ lösenord" };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = token && /^[a-f0-9]{64}$/.test(token);
  return <section className="section container narrow"><div className="auth-card panel">
    <h1 className="page-title">Välj nytt lösenord.</h1>
    {valid ? <><p>Länken kan användas en gång och gäller i 30 minuter. Kontots e-postadress verifieras samtidigt. Tidigare sessioner avslutas.</p><AccountForm kind="reset" token={token} /></> : <p className="notice notice-error" role="alert">Återställningslänken saknas eller är ogiltig.</p>}
    <p><Link href="/glomt-losenord" className="inline-link">Begär en ny länk</Link> · <Link href="/logga-in" className="inline-link">Till inloggning</Link></p>
  </div></section>;
}
