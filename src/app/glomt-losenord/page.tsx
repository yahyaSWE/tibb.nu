import Link from "next/link";
import { AccountForm } from "@/components/auth/account-forms";
import { emailConfigurationStatus } from "@/lib/email-provider";
import { PRIVATE_METADATA } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Glömt lösenord" };
export default function ForgottenPasswordPage() {
  const email = emailConfigurationStatus();
  return <section className="section container narrow"><div className="auth-card panel">
    <h1 className="page-title">Glömt lösenord?</h1><p>Ange konto-adressen. En giltig länk låter dig välja nytt lösenord och avslutar tidigare sessioner.</p>
    {!email.configured && <p className="notice notice-error" role="alert">{email.reason} Kontakta verksamheten för hjälp med ditt konto.</p>}
    <AccountForm kind="request-reset" disabled={!email.configured} />
    <p><Link href="/logga-in" className="inline-link">Till inloggning</Link> · <Link href="/kontakt" className="inline-link">Kontakta verksamheten</Link></p>
  </div></section>;
}
