import { CalendarDays, Clock3, ShieldOff } from "lucide-react";
import { getPractitioners, getSlots, getTreatments } from "@/lib/db";
import {
  getAvailabilityBlocks,
  getAvailabilitySchedules,
} from "@/lib/availability";
import { deleteAvailabilityBlockAction, saveSlotAction } from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  AdminSearchParams,
  dateOnly,
  dateTime,
  EmptyState,
  Field,
  ReturnTo,
  SectionHeading,
} from "@/components/admin/common";
import {
  AvailabilityBlockForm,
  AvailabilityScheduleForm,
  DeleteAvailabilityScheduleForm,
} from "@/components/admin/availability-forms";
import { UpcomingAvailabilitySlots } from "@/components/admin/upcoming-availability-slots";
import { SubmitButton } from "@/components/admin/submit-button";

const dayNames: Record<number, string> = {
  1: "Mån",
  2: "Tis",
  3: "Ons",
  4: "Tor",
  5: "Fre",
  6: "Lör",
  7: "Sön",
};
const calendarDate = (value: string) => dateOnly(`${value}T12:00:00Z`);

function defaultDates() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(new Date());
  function after(days: number) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  return {
    today,
    startDate: after(1),
    endDate: after(28),
    maxDate: after(730),
  };
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  const [treatments, practitioners, slots, schedules, blocks] =
    await Promise.all([
      getTreatments({ activeOnly: true }),
      getPractitioners({ activeOnly: true }),
      getSlots({ futureOnly: true, includeBlocked: true }),
      getAvailabilitySchedules(),
      getAvailabilityBlocks({ futureOnly: true }),
    ]);
  const defaults = defaultDates();
  const activeTreatments = new Set(treatments.map((treatment) => treatment.id));
  const activePractitioners = new Set(
    practitioners.map((practitioner) => practitioner.id),
  );
  const freeCount = slots.filter(
    (slot) =>
      !slot.booked &&
      !slot.blocked &&
      activeTreatments.has(slot.treatmentId) &&
      activePractitioners.has(slot.practitionerId),
  ).length;
  return (
    <>
      <AdminHeading
        title="Tillgängliga tider"
        description="Välj dina arbetsdagar, ge plats för pauser och stäng tider när du är ledig. Allt hanteras i svensk tid."
        action={
          <span className="availability-heading-stat">
            <CalendarDays size={19} aria-hidden="true" />
            <strong>{freeCount}</strong> lediga tider
          </span>
        }
      />
      <AdminNotice searchParams={searchParams} />
      <div className="availability-builder-grid">
        <section className="panel availability-schedule-panel">
          <div className="availability-panel-heading">
            <span className="availability-panel-icon">
              <Clock3 size={22} aria-hidden="true" />
            </span>
            <SectionHeading
              title="Skapa tillgänglighet"
              description="Skapa bokningsbara tider för flera arbetsdagar på en gång."
            />
          </div>
          {treatments.length && practitioners.length ? (
            <AvailabilityScheduleForm
              treatments={treatments}
              practitioners={practitioners}
              defaults={defaults}
            />
          ) : !practitioners.length ? (
            <EmptyState
              title="Lägg till en behandlare"
              href="/admin/behandlare"
              label="Hantera behandlare"
            >
              Du behöver en aktiv behandlare innan du kan skapa bokningsbara
              tider.
            </EmptyState>
          ) : (
            <EmptyState
              title="Börja med en behandling"
              href="/admin/behandlingar"
              label="Lägg till behandling"
            >
              Du behöver en synlig behandling innan du kan skapa bokningsbara
              tider.
            </EmptyState>
          )}
        </section>
        <section className="panel availability-block-panel">
          <div className="availability-panel-heading">
            <span className="availability-panel-icon">
              <ShieldOff size={22} aria-hidden="true" />
            </span>
            <SectionHeading
              title="Spärra tid eller dag"
              description="Stäng bokningen för en kort paus, en ledig dag eller en längre period."
            />
          </div>
          <AvailabilityBlockForm
            practitioners={practitioners}
            defaults={defaults}
          />
        </section>
      </div>
      <section className="panel availability-periods-panel">
        <SectionHeading
          title="Sparade perioder"
          description="Tiderna skapas när du sparar en period. Att ta bort perioden tar bort dess lediga framtida tider och bevarar bokningar."
        />
        {schedules.length ? (
          <div className="availability-period-list">
            {schedules.map((schedule) => (
              <article className="availability-period" key={schedule.id}>
                <div className="availability-period-info">
                  <p className="eyebrow">
                    {schedule.treatmentName} · {schedule.practitionerName}
                  </p>
                  <h3>
                    {calendarDate(schedule.startDate)} –{" "}
                    {calendarDate(schedule.endDate)}
                  </h3>
                  <div className="availability-period-meta">
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />
                      {[...schedule.weekdays]
                        .sort((a, b) => a - b)
                        .map((day) => dayNames[day])
                        .join(" · ")}
                    </span>
                    <span>
                      <Clock3 size={15} aria-hidden="true" />
                      {schedule.startTime}–{schedule.endTime}
                    </span>
                  </div>
                  <p className="muted availability-help">
                    {schedule.breaks.length
                      ? `Raster: ${schedule.breaks.map((item) => `${item.startTime}–${item.endTime}`).join(", ")}`
                      : "Inga raster"}{" "}
                    · {schedule.created} tider skapades
                    {schedule.skipped
                      ? ` · ${schedule.skipped} överlappande tider hoppades över`
                      : ""}
                  </p>
                </div>
                <DeleteAvailabilityScheduleForm id={schedule.id} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Planera din första period">
            Välj behandling, veckodagar och arbetstider ovan så skapas tiderna
            åt dig.
          </EmptyState>
        )}
      </section>
      <section className="panel availability-blocks-panel">
        <SectionHeading
          title="Spärrade tider och dagar"
          description="Ta bort en spärr för att öppna befintliga lediga tider för bokning igen."
        />
        {blocks.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Omfattning</th>
                  <th>Behandlare</th>
                  <th>Anteckning</th>
                  <th>
                    <span className="sr-only">Åtgärd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.id}>
                    <td>
                      <strong>
                        {block.allDay
                          ? `${dateOnly(block.start)} – ${dateOnly(new Date(Date.parse(block.end) - 1).toISOString())}`
                          : `${dateTime(block.start)} – ${dateTime(block.end)}`}
                      </strong>
                    </td>
                    <td>
                      <span className="badge badge-amber">
                        {block.allDay ? "Hela dagen" : "Valda klockslag"}
                      </span>
                    </td>
                    <td>{block.practitionerName || "Alla behandlare"}</td>
                    <td>
                      {block.reason || (
                        <span className="muted">Ingen anteckning</span>
                      )}
                    </td>
                    <td>
                      <form action={deleteAvailabilityBlockAction}>
                        <input type="hidden" name="id" value={block.id} />
                        <ReturnTo path="/admin/tider" />
                        <SubmitButton
                          className="button button-secondary button-small"
                          pendingLabel="Öppnar…"
                        >
                          Ta bort spärr
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Inga kommande spärrar">
            När du spärrar en dag eller tid visas den här.
          </EmptyState>
        )}
      </section>
      <section className="panel availability-upcoming-panel">
        <SectionHeading
          title="Kommande tider"
          description="Här ser du både bokningsbara tider, bokade besök och tider som är spärrade."
        />
        {slots.length ? (
          <UpcomingAvailabilitySlots slots={slots} />
        ) : (
          <EmptyState title="Inga kommande tider">
            Skapa en period ovan eller lägg till en enstaka tid nedan.
          </EmptyState>
        )}
      </section>
      <details className="panel availability-single-slot">
        <summary>
          <span>
            <Clock3 size={18} aria-hidden="true" />
            Lägg till en enstaka tid
          </span>
          <span className="muted">Visa formulär</span>
        </summary>
        <div className="availability-single-content">
          {treatments.length && practitioners.length ? (
            <form action={saveSlotAction} className="stack">
              <ReturnTo path="/admin/tider" />
              <div className="form-grid">
                <Field label="Behandlare" name="single-practitioner">
                  <select
                    id="single-practitioner"
                    name="practitionerId"
                    required
                  >
                    {practitioners.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Behandling" name="single-treatment">
                  <select id="single-treatment" name="treatmentId" required>
                    {treatments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.durationMinutes} min
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Datum och starttid"
                  name="single-start"
                  help="Sluttiden räknas ut från behandlingens längd."
                >
                  <input
                    type="datetime-local"
                    id="single-start"
                    name="start"
                    min={`${defaults.today}T00:00`}
                    required
                  />
                </Field>
              </div>
              <div>
                <SubmitButton pendingLabel="Publicerar tid…">
                  Publicera enstaka tid
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="muted">
              Lägg först till en aktiv behandlare och en synlig behandling.
            </p>
          )}
        </div>
      </details>
    </>
  );
}
