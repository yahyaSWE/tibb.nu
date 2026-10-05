"use client";

import { useId, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Slot } from "@/lib/types";
import { formatDateTime, localDateTime, TIME_ZONE } from "@/lib/time";

const weekdayLabels = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const monthFormat = new Intl.DateTimeFormat("sv-SE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("sv-SE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dateLabel = (date: string) =>
  dayFormat.format(new Date(date + "T12:00:00Z"));
const monthLabel = (month: string) =>
  monthFormat.format(new Date(month + "-01T12:00:00Z"));
function moveMonth(month: string, direction: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + direction, 1))
    .toISOString()
    .slice(0, 7);
}

export function BookingCalendar({
  slots,
  selectedSlotId,
  onSelect,
}: {
  slots: Slot[];
  selectedSlotId?: number;
  onSelect: (slotId: number | undefined) => void;
}) {
  const headingId = useId();
  const timesId = useId();
  const byDate = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of [...slots].sort((a, b) =>
      a.start.localeCompare(b.start),
    )) {
      const day = localDateTime(slot.start).slice(0, 10);
      groups.set(day, [...(groups.get(day) || []), slot]);
    }
    return groups;
  }, [slots]);
  const dates = [...byDate.keys()];
  const firstMonth =
    dates[0]?.slice(0, 7) ||
    localDateTime(new Date().toISOString()).slice(0, 7);
  const lastMonth = dates.at(-1)?.slice(0, 7) || firstMonth;
  const [requestedMonth, setMonth] = useState(firstMonth);
  const month =
    requestedMonth < firstMonth
      ? firstMonth
      : requestedMonth > lastMonth
        ? lastMonth
        : requestedMonth;
  const [selectedDate, setSelectedDate] = useState("");
  const activeDate =
    selectedDate.startsWith(month) && byDate.has(selectedDate)
      ? selectedDate
      : "";
  const [year, number] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const months: string[] = [];
  for (let value = firstMonth; value <= lastMonth; value = moveMonth(value, 1))
    months.push(value);
  const monthDates = dates.filter((date) => date.startsWith(month));
  const daySlots = byDate.get(activeDate) || [];
  const nextAvailableDate = dates.find((date) => date.slice(0, 7) > month);
  function changeMonth(value: string) {
    setMonth(value);
    setSelectedDate("");
    onSelect(undefined);
  }
  return (
    <div className="booking-calendar-layout">
      <section className="booking-calendar" aria-labelledby={headingId}>
        <div className="calendar-toolbar">
          <button
            type="button"
            className="calendar-nav"
            aria-label="Föregående månad"
            disabled={month <= firstMonth}
            onClick={() => changeMonth(moveMonth(month, -1))}
          >
            <ChevronLeft size={19} />
          </button>
          <div className="calendar-month-heading">
            <h3 id={headingId} aria-live="polite">
              {monthLabel(month)}
            </h3>
            <select
              aria-label="Välj månad"
              value={month}
              onChange={(event) => changeMonth(event.target.value)}
            >
              {months.map((value) => (
                <option key={value} value={value}>
                  {monthLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="calendar-nav"
            aria-label="Nästa månad"
            disabled={month >= lastMonth}
            onClick={() => changeMonth(moveMonth(month, 1))}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-days">
          {Array.from({ length: cellCount }, (_, index) => {
            const day = index - offset + 1;
            if (day < 1 || day > daysInMonth)
              return (
                <span
                  key={index}
                  className="calendar-empty"
                  aria-hidden="true"
                />
              );
            const date = `${month}-${String(day).padStart(2, "0")}`;
            const count = byDate.get(date)?.length || 0;
            return (
              <button
                key={date}
                type="button"
                className={`calendar-day${activeDate === date ? " is-selected" : ""}`}
                disabled={!count}
                aria-pressed={activeDate === date}
                aria-controls={timesId}
                aria-label={`${dateLabel(date)}, ${count ? `${count} lediga tider` : "inga lediga tider"}`}
                onClick={() => {
                  setSelectedDate(date);
                  onSelect(undefined);
                }}
              >
                <span>{day}</span>
                {count > 0 && <i aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <p className="calendar-key">
          <span aria-hidden="true" /> Gröna dagar har lediga tider
        </p>
        {!monthDates.length && (
          <div className="calendar-empty-month" role="status">
            <p>Inga lediga tider den här månaden.</p>
            {nextAvailableDate && (
              <button
                type="button"
                className="text-link"
                onClick={() => changeMonth(nextAvailableDate.slice(0, 7))}
              >
                Visa nästa månad med lediga tider
              </button>
            )}
          </div>
        )}
      </section>
      <section
        className="calendar-times"
        id={timesId}
        aria-live="polite"
        aria-label="Lediga tider för valt datum"
      >
        {activeDate ? (
          <>
            <p className="eyebrow">VÄLJ KLOCKSLAG</p>
            <h4>{dateLabel(activeDate)}</h4>
            <p className="calendar-times-count">
              {daySlots.length} lediga tider · svensk tid
            </p>
            <div className="slot-options">
              {daySlots.map((slot) => (
                <label className="slot-option" key={slot.id}>
                  <input
                    type="radio"
                    name="slotId"
                    value={slot.id}
                    checked={selectedSlotId === slot.id}
                    onChange={() => onSelect(slot.id)}
                    required
                    aria-label={formatDateTime(slot.start)}
                  />
                  <span>{timeFormat.format(new Date(slot.start))}</span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="calendar-date-prompt">
            <CalendarDays size={30} strokeWidth={1.3} />
            <h4>Välj en dag i kalendern</h4>
            <p>Här visas dagens lediga tider när du har valt ett datum.</p>
          </div>
        )}
      </section>
    </div>
  );
}
