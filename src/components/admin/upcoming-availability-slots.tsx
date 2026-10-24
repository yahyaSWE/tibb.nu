"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { deleteSlotAction, deleteSlotsAction } from "@/lib/actions";
import type { Slot } from "@/lib/types";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";

const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Stockholm",
});
const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "medium",
  timeZone: "Europe/Stockholm",
});
const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Stockholm",
});
const pageSize = 50;

export function UpcomingAvailabilitySlots({ slots }: { slots: Slot[] }) {
  const [month, setMonth] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);
  const [practitionerId, setPractitionerId] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmationId = useId();
  const [, removeSelected, deleting] = useActionState(async (_previous: null, form: FormData) => {
    await deleteSlotsAction(form);
    return null;
  }, null);
  const entries = useMemo(
    () =>
      slots.map((slot) => ({
        slot,
        date: dateFormat.format(new Date(slot.start)),
        day: dayFormat.format(new Date(slot.start)),
        time: `${timeFormat.format(new Date(slot.start))}–${timeFormat.format(new Date(slot.end))}`,
      })),
    [slots],
  );
  const months = [
    ...new Set(entries.map((entry) => entry.date.slice(0, 7))),
  ].sort();
  const filtered = entries.filter(
    (entry) =>
      (!month || entry.date.startsWith(month)) &&
      (!practitionerId ||
        entry.slot.practitionerId === Number(practitionerId)) &&
      (!from || entry.date >= from) &&
      (!until || entry.date <= until),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * pageSize;
  const visible = filtered.slice(offset, offset + pageSize);
  const selectable = filtered.filter(entry => !entry.slot.booked);
  const selectableVisible = visible.filter(entry => !entry.slot.booked);
  // Derive the submitted IDs from the current data and filters, never stale
  // selections hidden by a changed filter or a refreshed list of bookings.
  const selectedIds = selectable.filter(entry => selected.has(entry.slot.id)).map(entry => entry.slot.id);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(entry => selected.has(entry.slot.id));
  const someVisibleSelected = selectableVisible.some(entry => selected.has(entry.slot.id));

  function clearSelection() { setSelected(new Set()); setConfirmDelete(false); }
  function selectIds(ids: number[], checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      for (const id of ids) if (checked) next.add(id); else next.delete(id);
      return next;
    });
    setConfirmDelete(false);
  }

  function reset() {
    setMonth("");
    setFrom("");
    setUntil("");
    setPage(1);
    setPractitionerId("");
    clearSelection();
  }

  return (
    <>
      <div className="availability-slot-filters">
        <Field label="Behandlare" name="slots-practitioner">
          <select
            id="slots-practitioner"
            disabled={deleting}
            value={practitionerId}
            onChange={(event) => {
              setPractitionerId(event.target.value);
              setPage(1);
              clearSelection();
            }}
          >
            <option value="">Alla behandlare</option>
            {[
              ...new Map(
                slots.map((slot) => [
                  slot.practitionerId,
                  slot.practitionerName,
                ]),
              ).entries(),
            ].map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Månad" name="slots-month">
          <select
            id="slots-month"
            disabled={deleting}
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
              clearSelection();
            }}
          >
            <option value="">Alla månader</option>
            {months.map((value) => (
              <option key={value} value={value}>
                {new Intl.DateTimeFormat("sv-SE", {
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Stockholm",
                }).format(new Date(`${value}-15T12:00:00Z`))}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Från datum" name="slots-from">
          <input
            id="slots-from"
            disabled={deleting}
            type="date"
            value={from}
            max={until || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
              clearSelection();
            }}
          />
        </Field>
        <Field label="Till och med datum" name="slots-until">
          <input
            id="slots-until"
            disabled={deleting}
            type="date"
            value={until}
            min={from || undefined}
            onChange={(event) => {
              setUntil(event.target.value);
              setPage(1);
              clearSelection();
            }}
          />
        </Field>
        {practitionerId || month || from || until ? (
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={reset}
            disabled={deleting}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Rensa
          </button>
        ) : null}
      </div>
      {visible.length ? (
        <>
          <div className="availability-results-count" aria-live="polite">
            Visar {offset + 1}–{offset + visible.length} av {filtered.length}{" "}
            tider
          </div>
          <div className="availability-bulk-toolbar">
            <p role="status">{selectedIds.length} {selectedIds.length === 1 ? "tid markerad" : "tider markerade"}</p>
            <div className="availability-bulk-actions">
              <button type="button" className="button button-secondary button-small" disabled={deleting || !selectable.length} onClick={() => {setSelected(new Set(selectable.map(entry => entry.slot.id)));setConfirmDelete(false);}}>
                Markera alla filtrerade ({selectable.length})
              </button>
              {selectedIds.length > 0 && <>
                <button type="button" className="button button-secondary button-small" disabled={deleting} onClick={clearSelection}>Rensa markering</button>
                <button type="button" className="button button-secondary button-small delete-button" disabled={deleting} aria-expanded={confirmDelete} aria-controls={confirmationId} onClick={() => setConfirmDelete(true)}>Ta bort markerade ({selectedIds.length})</button>
              </>}
            </div>
            <small>”Markera alla filtrerade” väljer obokade tider på alla sidor. Bokade tider kan inte markeras. Markeringen rensas när du ändrar ett filter.</small>
          </div>
          {confirmDelete && selectedIds.length > 0 && <form id={confirmationId} action={removeSelected} className="availability-bulk-confirm">
            <ReturnTo path="/admin/tider" />
            <input type="hidden" name="slotIds" value={JSON.stringify(selectedIds)} />
            <p>Vill du ta bort {selectedIds.length} {selectedIds.length === 1 ? "markerad, obokad tid" : "markerade, obokade tider"}? Om en tid har hunnit bli bokad behålls den.</p>
            <div className="availability-bulk-actions">
              <SubmitButton className="button button-secondary button-small delete-button" pendingLabel="Tar bort markerade tider…">Ja, ta bort {selectedIds.length} {selectedIds.length === 1 ? "tid" : "tider"}</SubmitButton>
              <button type="button" className="button button-secondary button-small" disabled={deleting} onClick={() => setConfirmDelete(false)}>Avbryt</button>
            </div>
          </form>}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="availability-select-cell"><input type="checkbox" aria-label="Markera alla obokade tider på denna sida" checked={allVisibleSelected} disabled={deleting || !selectableVisible.length} ref={node => {if(node) node.indeterminate = someVisibleSelected && !allVisibleSelected;}} onChange={event => selectIds(selectableVisible.map(entry => entry.slot.id), event.target.checked)} /></th>
                  <th>Datum</th>
                  <th>Tid</th>
                  <th>Behandling</th>
                  <th>Behandlare</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Åtgärd</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ slot, day, time }) => (
                  <tr key={slot.id}>
                    <td className="availability-select-cell"><input type="checkbox" aria-label={`Markera ${slot.treatmentName}, ${slot.practitionerName}, ${day}, ${time}`} checked={!slot.booked && selected.has(slot.id)} disabled={deleting || slot.booked} onChange={event => selectIds([slot.id], event.target.checked)} /></td>
                    <td>{day}</td>
                    <td className="availability-time-cell">{time}</td>
                    <td>{slot.treatmentName}</td>
                    <td>{slot.practitionerName}</td>
                    <td>
                      <span
                        className={`badge ${slot.booked ? "badge-amber" : slot.blocked ? "availability-blocked-badge" : "badge-green"}`}
                      >
                        {slot.booked
                          ? "Bokad"
                          : slot.blocked
                            ? "Spärrad"
                            : "Ledig"}
                      </span>
                    </td>
                    <td>
                      {!slot.booked && !deleting ? (
                        <form action={deleteSlotAction}>
                          <input type="hidden" name="id" value={slot.id} />
                          <ReturnTo path="/admin/tider" />
                          <SubmitButton
                            className="button button-secondary button-small delete-button"
                            pendingLabel="Tar bort…"
                          >
                            Ta bort tid
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="muted">{slot.booked ? "Hantera i bokningar" : "Borttagning pågår…"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <nav
              className="availability-pagination"
              aria-label="Bläddra bland tillgängliga tider"
            >
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={deleting || currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ArrowLeft size={15} aria-hidden="true" />
                Föregående
              </button>
              <span>
                Sida {currentPage} av {pageCount}
              </span>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={deleting || currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Nästa
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          <h3>Inga tider matchar ditt urval</h3>
          <p>Välj en annan månad eller justera datumintervallet.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={reset}
          >
            Visa alla tider
          </button>
        </div>
      )}
    </>
  );
}
