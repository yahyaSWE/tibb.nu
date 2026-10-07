import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sprout } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { signupAction } from "@/lib/actions";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata: Metadata = { ...PRIVATE_METADATA, title: "Skapa konto" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(user.role === "admin" ? "/admin" : "/elevportal");
  return (
    <section className="section container auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">Ett nytt steg</p>
        <h1 className="page-title">
          Låt din kunskap
          <br />
          <em>växa.</em>
        </h1>
        <p className="lead muted">
          Skapa ditt konto för en egen plats i Tibb.nu:s elevportal. När du
          anmält dig till en kurs ger vi dig tillgång här.
        </p>
        <Sprout
          className="auth-leaf"
          size={130}
          strokeWidth={0.8}
          aria-hidden="true"
        />
      </div>
      <div className="auth-card panel">
        <h2>Skapa ett konto</h2>
        <p className="muted">Börja med dina uppgifter nedan.</p>
        {params.error && (
          <p className="notice notice-error" role="alert">
            {params.error}
          </p>
        )}
        <form action={signupAction} className="auth-form">
          <label className="field">
            Ditt namn
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              placeholder="För- och efternamn"
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="field">
            E-postadress
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="din@epost.se"
              maxLength={254}
            />
          </label>
          <label className="field">
            Lösenord
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
            <small className="muted">Använd minst 12 tecken.</small>
          </label>
          <p className="small muted">
            Ditt konto används för inloggning, kursåtkomst och dina framsteg.
            Tibb.nu tilldelar kursåtkomst efter anmälan.
          </p>
          <button className="button button-primary full-width" type="submit">
            Skapa konto <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch muted">
          Har du redan ett konto?{" "}
          <Link href="/logga-in" className="inline-link">
            Logga in
          </Link>
        </p>
      </div>
    </section>
  );
}
