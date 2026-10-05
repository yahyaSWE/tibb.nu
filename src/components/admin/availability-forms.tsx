"use client";

import { useState } from "react";
import { CalendarDays, Coffee, Plus, ShieldOff, Trash2 } from "lucide-react";
import {
  deleteAvailabilityScheduleAction,
  saveAvailabilityBlockAction,
  saveAvailabilityScheduleAction,
} from "@/lib/actions";
import type { Practitioner, Treatment } from "@/lib/types";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";

const weekdays = [
  { value: 1, label: "Måndag", short: "Mån" },
  { value: 2, label: "Tisdag", short: "Tis" },
  { value: 3, label: "Onsdag", short: "Ons" },
  { value: 4, label: "Torsdag", short: "Tor" },
  { value: 5, label: "Fredag", short: "Fre" },
  { value: 6, label: "Lördag", short: "Lör" },
  { value: 7, label: "Söndag", short: "Sön" },
];
type BreakInput = { id: number; startTime: string; endTime: string };
type DateDefaults = {
  today: string;
  startDate: string;
  endDate: string;
  maxDate: string;
};

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function afterDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function matchingDays(start: string, end: string, selected: number[]) {
  const first = new Date(`${start}T12:00:00Z`);
  const days =
    Math.floor((Date.parse(`${end}T12:00:00Z`) - first.getTime()) / 86400000) +
    1;
  if (!Number.isFinite(days) || days < 1) return 0;
  let count = Math.floor(days / 7) * selected.length;
  for (let offset = 0; offset < days % 7; offset++) {
    const day = (first.getUTCDay() + offset) % 7 || 7;
    if (selected.includes(day)) count++;
  }
  return count;
}

export function AvailabilityScheduleForm({
  treatments,
  practitioners,
  defaults,
}: {
  treatments: Treatment[];
  practitioners: Practitioner[];
  defaults: DateDefaults;
}) {
  const [treatmentId, setTreatmentId] = useState(
    String(treatments[0]?.id || ""),
  );
  const [practitionerId, setPractitionerId] = useState(
    String(practitioners[0]?.id || ""),
  );
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breaks, setBreaks] = useState<BreakInput[]>([]);
  const [nextBreakId, setNextBreakId] = useState(1);
  const [validationError, setValidationError] = useState("");
  const lastPeriodDay = afterDays(startDate, 89);
  const maximumEndDate =
    lastPeriodDay && lastPeriodDay < defaults.maxDate
      ? lastPeriodDay
      : defaults.maxDate;
  const treatment = treatments.find((item) => String(item.id) === treatmentId);
  const workMinutes = Math.max(0, minutes(endTime) - minutes(startTime));
  const breakMinutes = breaks.reduce(
    (total, item) =>
      total +
      Math.max(
        0,
        Math.min(minutes(item.endTime), minutes(endTime)) -
          Math.max(minutes(item.startTime), minutes(startTime)),
      ),
    0,
  );
  const dayCount = matchingDays(startDate, endDate, selectedDays);
  const slotsPerDay = treatment
    ? Math.floor(
        Math.max(0, workMinutes - breakMinutes) / treatment.durationMinutes,
      )
    : 0;
  const approximateSlots = Number.isFinite(slotsPerDay)
    ? slotsPerDay * dayCount
    : 0;

  function changeBreak(
    id: number,
    field: "startTime" | "endTime",
    value: string,
  ) {
    setBreaks((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <form
      action={saveAvailabilityScheduleAction}
      className="stack availability-schedule-form"
      onSubmit={(event) => {
        if (!selectedDays.length) {
          event.preventDefault();
          setValidationError("Välj minst en veckodag för att skapa tider.");
        } else setValidationError("");
      }}
    >
      <ReturnTo path="/admin/tider" />
      <Field label="Behandlare" name="schedule-practitioner">
        <select
          id="schedule-practitioner"
          name="practitionerId"
          value={practitionerId}
          onChange={(event) => setPractitionerId(event.target.value)}
          required
        >
          {practitioners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Behandling" name="schedule-treatment">
        <select
          id="schedule-treatment"
          name="treatmentId"
          value={treatmentId}
          onChange={(event) => setTreatmentId(event.target.value)}
          required
        >
          {treatments.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name} · {item.durationMinutes} min
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Från datum" name="schedule-start-date">
          <input
            id="schedule-start-date"
            type="date"
            name="startDate"
            value={startDate}
            min={defaults.today}
            max={defaults.maxDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (event.target.value > endDate) setEndDate(event.target.value);
            }}
            required
          />
        </Field>
        <Field label="Till och med datum" name="schedule-end-date">
          <input
            id="schedule-end-date"
            type="date"
            name="endDate"
            value={endDate}
            min={startDate || defaults.today}
            max={maximumEndDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </Field>
      </div>
      <fieldset className="availability-fieldset">
        <legend>Veckodagar</legend>
        <div className="availability-weekdays">
          {weekdays.map((day) => (
            <label
              key={day.value}
              className={`availability-day${selectedDays.includes(day.value) ? " selected" : ""}`}
            >
              <input
                className="sr-only"
                name="weekdays"
                type="checkbox"
                value={day.value}
                aria-label={day.label}
                checked={selectedDays.includes(day.value)}
                onChange={(event) => {
                  setSelectedDays((current) =>
                    event.target.checked
                      ? [...current, day.value].sort((a, b) => a - b)
                      : current.filter((value) => value !== day.value),
                  );
                  setValidationError("");
                }}
              />
              <span>{day.short}</span>
            </label>
          ))}
        </div>
        <p className="muted availability-help">
          Tider skapas på valda veckodagar. En period kan vara högst 90 dagar.
        </p>
      </fieldset>
      <div className="form-grid">
        <Field label="Arbetsdagen börjar" name="schedule-start-time">
          <input
            id="schedule-start-time"
            type="time"
            name="startTime"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            step={300}
            required
          />
        </Field>
        <Field label="Arbetsdagen slutar" name="schedule-end-time">
          <input
            id="schedule-end-time"
            type="time"
            name="endTime"
            value={endTime}
            min={startTime}
            onChange={(event) => setEndTime(event.target.value)}
            step={300}
            required
          />
        </Field>
      </div>
      <div className="availability-breaks">
        <div className="availability-subheading">
          <span>
            <Coffee size={17} aria-hidden="true" />
            Raster
          </span>
          <button
            type="button"
            className="button button-secondary button-small"
            disabled={breaks.length >= 12}
            onClick={() => {
              setBreaks((current) => [
                ...current,
                { id: nextBreakId, startTime: "12:00", endTime: "13:00" },
              ]);
              setNextBreakId((current) => current + 1);
            }}
          >
            <Plus size={14} aria-hidden="true" />
            Lägg till rast
          </button>
        </div>
        {breaks.length ? (
          breaks.map((item, index) => (
            <div className="availability-break" key={item.id}>
              <Field
                label={`Rast ${index + 1} börjar`}
                name={`schedule-break-${item.id}-start`}
              >
                <input
                  id={`schedule-break-${item.id}-start`}
                  type="time"
                  name="breakStart"
                  value={item.startTime}
                  onChange={(event) =>
                    changeBreak(item.id, "startTime", event.target.value)
                  }
                  min={startTime}
                  max={endTime}
                  step={300}
                  required
                />
              </Field>
              <Field
                label={`Rast ${index + 1} slutar`}
                name={`schedule-break-${item.id}-end`}
              >
                <input
                  id={`schedule-break-${item.id}-end`}
                  type="time"
                  name="breakEnd"
                  value={item.endTime}
                  onChange={(event) =>
                    changeBreak(item.id, "endTime", event.target.value)
                  }
                  min={item.startTime || startTime}
                  max={endTime}
                  step={300}
                  required
                />
              </Field>
              <button
                type="button"
                className="availability-icon-button"
                aria-label={`Ta bort rast ${index + 1}`}
                onClick={() =>
                  setBreaks((current) =>
                    current.filter((value) => value.id !== item.id),
                  )
                }
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </div>
          ))
        ) : (
          <p className="muted availability-help">
            Ingen rast tillagd. Lägg till pauser som ska vara fria från
            bokningar.
          </p>
        )}
      </div>
      <div className="availability-summary" aria-live="polite">
        <CalendarDays size={22} aria-hidden="true" />
        <div>
          <strong>
            {dayCount} arbetsdagar · cirka {approximateSlots} möjliga tider
          </strong>
          <p>
            {treatment
              ? `${treatment.durationMinutes} minuter per besök. `
              : ""}
            Befintliga tider och bokningar räknas av. Spärrade tider hålls
            stängda.
          </p>
        </div>
      </div>
      {approximateSlots > 2000 ? (
        <p className="notice">
          Välj en kortare period. Högst 2 000 tider kan skapas åt gången.
        </p>
      ) : null}
      {validationError ? (
        <p className="notice notice-error" role="alert">
          {validationError}
        </p>
      ) : null}
      <SubmitButton
        className="button button-primary availability-submit"
        pendingLabel="Skapar bokningsbara tider…"
      >
        Skapa bokningsbara tider
      </SubmitButton>
    </form>
  );
}

export function AvailabilityBlockForm({
  practitioners,
  defaults,
}: {
  practitioners: Practitioner[];
  defaults: DateDefaults;
}) {
  const [allDay, setAllDay] = useState(true);
  const [practitionerId, setPractitionerId] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.startDate);
  return (
    <form
      action={saveAvailabilityBlockAction}
      className="stack availability-block-form"
    >
      <ReturnTo path="/admin/tider" />
      <Field label="Spärren gäller" name="block-practitioner">
        <select
          id="block-practitioner"
          name="practitionerId"
          value={practitionerId}
          onChange={(event) => setPractitionerId(event.target.value)}
        >
          <option value="">Alla behandlare</option>
          {practitioners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="availability-all-day">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
        />
        <span>
          <strong>Spärra hela dagen</strong>
          <small>Passar för semester, ledighet eller inställda dagar.</small>
        </span>
      </label>
      <div className="form-grid">
        <Field label="Från datum" name="block-start-date">
          <input
            id="block-start-date"
            type="date"
            name="startDate"
            value={startDate}
            min={defaults.today}
            max={defaults.maxDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (event.target.value > endDate) setEndDate(event.target.value);
            }}
            required
          />
        </Field>
        <Field label="Till och med datum" name="block-end-date">
          <input
            id="block-end-date"
            type="date"
            name="endDate"
            value={endDate}
            min={startDate || defaults.today}
            max={defaults.maxDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </Field>
      </div>
      {!allDay ? (
        <>
          <div className="form-grid">
            <Field label="Från klockan" name="block-start-time">
              <input
                id="block-start-time"
                type="time"
                name="startTime"
                defaultValue="09:00"
                step={300}
                required
              />
            </Field>
            <Field label="Till klockan" name="block-end-time">
              <input
                id="block-end-time"
                type="time"
                name="endTime"
                defaultValue="17:00"
                step={300}
                required
              />
            </Field>
          </div>
          <p className="muted availability-help">
            Spärren gäller sammanhängande från startdatumets starttid till
            slutdatumets sluttid.
          </p>
        </>
      ) : null}
      <Field
        label="Anledning (valfritt)"
        name="block-reason"
        help="Anteckningen visas bara i administrationen."
      >
        <input
          id="block-reason"
          name="reason"
          maxLength={300}
          placeholder="Till exempel: semester eller planeringsdag"
        />
      </Field>
      <div className="availability-block-note">
        <ShieldOff size={19} aria-hidden="true" />
        <p>
          Redan bokade besök måste avbokas manuellt innan du kan spärra tiden.
          {practitionerId
            ? " Spärren gäller den valda behandlarens behandlingar."
            : " Spärren gäller alla behandlare och behandlingar."}
        </p>
      </div>
      <SubmitButton
        className="button button-primary availability-submit"
        pendingLabel="Sparar spärr…"
      >
        {allDay ? "Spärra valda dagar" : "Spärra vald tid"}
      </SubmitButton>
    </form>
  );
}

export function DeleteAvailabilityScheduleForm({ id }: { id: number }) {
  return (
    <form
      action={deleteAvailabilityScheduleAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Ta bort perioden och dess lediga framtida tider? Befintliga bokningar behålls.",
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <ReturnTo path="/admin/tider" />
      <SubmitButton
        className="button button-secondary button-small delete-button"
        pendingLabel="Tar bort…"
      >
        Ta bort period
      </SubmitButton>
    </form>
  );
}
