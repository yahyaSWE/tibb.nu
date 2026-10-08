import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/auth/account-forms";
import { requireUser } from "@/lib/auth";
import { emailConfigurationStatus } from "@/lib/email-provider";
import { PRIVATE_METADATA } from "@/lib/seo";
export const dynamic = "force-dynamic";
export const metadata = { ...PRIVATE_METADATA, title: "Verifiera e-post" };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; message?: string }> }) {
  const params = await searchParams;
  if (params.token) return <section className="section container narrow"><div className="auth-card panel">
    <h1 className="page-title">Verifiera e-post.</h1>
    {/^[a-f0-9]{64}$/.test(params.token) ? <><p>Ange lösenordet du valde när du registrerade kontot. Om du inte skapade kontot, bekräfta det inte. Använd återställning för att återta din e-postadress.</p><AccountForm kind="verify" token={params.token} /></> : <p className="notice notice-error">Verifieringslänken är ogiltig.</p>}
    <p><Link href="/glomt-losenord" className="inline-link">Glömt lösenord eller inte ditt konto?</Link></p>
  </div></section>;
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");
  if (user.emailVerifiedAt) redirect("/elevportal");
  const email = emailConfigurationStatus();
  return <section className="section container narrow"><div className="auth-card panel">
    <h1 className="page-title">Bekräfta din e-post.</h1>
    <p>Verifiera {user.email} innan administratören tilldelar en ny kurs. Ditt konto och befintliga framsteg finns kvar.</p>
    {params.message && <p className="notice" role="status">{params.message}</p>}
    {!email.configured && <p className="notice notice-error" role="alert">{email.reason} Kontakta verksamheten; adressen är inte verifierad ännu.</p>}
    <AccountForm kind="resend" disabled={!email.configured} />
    <p><Link href="/elevportal" className="inline-link">Till elevportalen</Link> · <Link href="/kontakt" className="inline-link">Kontakt</Link></p>
  </div></section>;
}
