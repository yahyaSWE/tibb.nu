import { getSlots, getTreatments } from "@/lib/db";
import { saveSlotAction, deleteSlotAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateTime,
  EmptyState,
  Field,
  ReturnTo,
  SectionHeading,
} from "@/components/admin/common";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const [treatments, slots] = await Promise.all([
    getTreatments({ activeOnly: true }),
    getSlots({ futureOnly: true }),
  ]);
  return (
    <>
      <AdminHeading
        title="Tillgängliga tider"
        description="Publicera tider som kunder kan välja när de bokar. Alla tider visas i svensk tid."
      />
      <AdminNotice searchParams={searchParams} />
      <div className="split-grid">
        <section className="panel">
          <SectionHeading title="Kommande tider" />
          {slots.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Datum och tid</th>
                    <th>Behandling</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Åtgärd</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id}>
                      <td>{dateTime(slot.start)}</td>
                      <td>{slot.treatmentName}</td>
                      <td>
                        <span
                          className={`badge ${slot.booked ? "badge-amber" : "badge-green"}`}
                        >
                          {slot.booked ? "Bokad" : "Ledig"}
                        </span>
                      </td>
                      <td>
                        {!slot.booked ? (
                          <form action={deleteSlotAction}>
                            <input type="hidden" name="id" value={slot.id} />
                            <ReturnTo path="/admin/tider" />
                            <button
                              type="submit"
                              className="button button-secondary button-small delete-button"
                            >
                              Ta bort
                            </button>
                          </form>
                        ) : (
                          <span className="muted">Hantera i bokningar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Inga kommande tider">
              Lägg till tider för de behandlingar du vill öppna för bokning.
            </EmptyState>
          )}
        </section>
        <section className="panel">
          <SectionHeading
            title="Lägg till en tid"
            description="Sluttiden räknas ut från behandlingens längd."
          />
          {treatments.length ? (
            <form action={saveSlotAction} className="stack">
              <ReturnTo path="/admin/tider" />
              <Field label="Behandling" name="treatmentId">
                <select id="treatmentId" name="treatmentId" required>
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.durationMinutes} min
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Datum och starttid"
                name="start"
                help="Tidszon: Europe/Stockholm"
              >
                <input type="datetime-local" id="start" name="start" required />
              </Field>
              <div>
                <button type="submit" className="button button-primary">
                  Publicera tid
                </button>
              </div>
            </form>
          ) : (
            <EmptyState
              title="Börja med en behandling"
              href="/admin/behandlingar"
              label="Lägg till behandling"
            >
              Du behöver en synlig behandling innan du kan publicera tider.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
