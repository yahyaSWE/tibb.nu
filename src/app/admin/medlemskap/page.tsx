import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminPlans, getMembershipSettings } from "@/lib/memberships";
import { getAdminSubscriptions, membershipBillingReady, membershipPortalReady } from "@/lib/membership-billing";
import { AdminHeading, AdminNotice, type AdminSearchParams } from "@/components/admin/common";
import { MembershipSettingsForm } from "@/components/admin/membership-forms";
import { MembershipPlanCard } from "@/components/memberships/views";
import { SubscriptionList } from "@/components/memberships/subscription-list";

export default async function MembershipAdminPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const user = await requireAdmin();
  const [plans, settings, subscriptions] = await Promise.all([
    getAdminPlans(user.id),
    getMembershipSettings(),
    getAdminSubscriptions(user.id),
  ]);

  return (
    <>
      <AdminHeading
        title="Medlemskap och abonnemang"
        description="Hantera erbjudanden, försäljningsvillkor och elevabonnemang."
        sections={[
          ["erbjudanden", "Medlemskap"],
          ["forsaljning", "Försäljning och villkor"],
          ["abonnemang", "Elevabonnemang"],
        ]}
        action={<Link href="/admin/medlemskap/ny" className="button button-primary">Skapa medlemskap</Link>}
      />
      <AdminNotice searchParams={searchParams} />
      <div className="stack">
        <div className="notice" role="status">
          Försäljning: {settings.salesEnabled ? "öppen" : "avstängd"} · Betalningskonfiguration: {membershipBillingReady() ? "angiven" : "saknas"} · Kundportal: {membershipPortalReady() ? "angiven" : "saknas"}.
          {" "}Anslutningen behöver testas i Stripe innan du börjar sälja.
        </div>
        <section id="erbjudanden" tabIndex={-1} className="panel admin-section-target">
          <h2>Medlemskap</h2>
          {plans.length ? (
            <div className="membership-cards">
              {plans.map(plan => <MembershipPlanCard plan={plan} admin key={plan.id} />)}
            </div>
          ) : <p className="muted">Skapa först en grupp och lägg sedan upp ditt första medlemskap.</p>}
          <Link href="/admin/grupper" className="text-link">Hantera grupper och innehåll</Link>
        </section>
        <section id="forsaljning" tabIndex={-1} className="panel form-panel admin-section-target">
          <h2>Försäljning och villkor</h2>
          <MembershipSettingsForm settings={settings} />
        </section>
        <section id="abonnemang" tabIndex={-1} className="panel admin-section-target">
          <h2>Elevabonnemang</h2>
          <SubscriptionList subscriptions={subscriptions} admin />
        </section>
      </div>
    </>
  );
}
