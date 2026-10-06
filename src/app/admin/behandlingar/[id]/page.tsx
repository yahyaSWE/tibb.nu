import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTreatment } from "@/lib/db";
import { deleteTreatmentAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  ReturnTo,
} from "@/components/admin/common";
import { TreatmentForm } from "@/components/admin/treatment-form";

export default async function EditTreatmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const { id } = await params;
  const treatmentId = Number(id);
  if (!Number.isSafeInteger(treatmentId) || treatmentId < 1) notFound();
  const treatment = await getTreatment(treatmentId);
  if (!treatment) notFound();
  return (
    <>
      <AdminHeading
        title={treatment.name}
        description="Ändringar gäller för nya bokningar. Befintliga bokningar behåller sina uppgifter."
        action={
          <Link href="/admin/behandlingar" className="button button-secondary">
            Alla behandlingar
          </Link>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <section className="panel form-panel">
        <TreatmentForm
          treatment={treatment}
          returnTo={`/admin/behandlingar/${id}`}
        />
      </section>
      <section className="panel danger-panel">
        <h2>Dölj behandling</h2>
        <p className="muted">
          Behandlingen försvinner från bokningssidan. Dina befintliga bokningar
          och deras uppgifter sparas.
        </p>
        <form action={deleteTreatmentAction}>
          <input type="hidden" name="id" value={id} />
          <ReturnTo path="/admin/behandlingar" />
          <button
            className="button button-secondary delete-button"
            type="submit"
          >
            Dölj behandling
          </button>
        </form>
      </section>
    </>
  );
}
