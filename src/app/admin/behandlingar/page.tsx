import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getTreatments } from "@/lib/db";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  EmptyState,
  kronor,
  SectionHeading,
} from "@/components/admin/common";
import { TreatmentForm } from "@/components/admin/treatment-form";

export default async function TreatmentsPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const treatments = await getTreatments();
  return (
    <>
      <AdminHeading
        title="Behandlingar"
        description="Bestäm vad du erbjuder, hur långt besöket är och vad det kostar."
      />
      <AdminNotice searchParams={searchParams} />
      <div className="split-grid">
        <section className="panel">
          <SectionHeading title="Dina behandlingar" />
          {treatments.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Behandling</th>
                    <th>Längd</th>
                    <th>Pris</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Åtgärd</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td>{t.durationMinutes} min</td>
                      <td>{kronor(t.priceOre)}</td>
                      <td>
                        <span
                          className={`badge ${t.active ? "badge-green" : ""}`}
                        >
                          {t.active ? "Synlig" : "Dold"}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button button-secondary button-small"
                          href={`/admin/behandlingar/${t.id}`}
                        >
                          Redigera
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Din första behandling">
              Lägg till en behandling och publicera sedan bokningsbara tider.
            </EmptyState>
          )}
        </section>
        <section className="panel">
          <SectionHeading
            title="Ny behandling"
            description="Du kan ändra längd, pris och synlighet när som helst."
          />
          <TreatmentForm returnTo="/admin/behandlingar" />
        </section>
      </div>
    </>
  );
}
