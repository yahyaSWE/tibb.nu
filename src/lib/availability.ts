import { z } from "zod";
import {
  DomainError,
  expireBookings,
  getDb,
  getPractitioner,
  getTreatment,
  getUser,
  transaction,
} from "./db";
import { localDateTime } from "./time";
import type {
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilitySchedule,
  AvailabilityScheduleInput,
} from "./types";

export type {
  AvailabilityBreak,
  AvailabilityBlock,
  AvailabilityBlockInput,
  AvailabilitySchedule,
  AvailabilityScheduleInput,
} from "./types";

const DAY = 86_400_000;
const MINUTE = 60_000;
const MAX_CANDIDATES = 2000;
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ange ett giltigt datum.");
const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ange ett giltigt klockslag.");
const scheduleSchema = z.object({
  treatmentId: z.number().int().positive(),
  practitionerId: z.number().int().positive().default(1),
  startDate: dateSchema,
  endDate: dateSchema,
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  startTime: clockSchema,
  endTime: clockSchema,
  breaks: z
    .array(z.object({ startTime: clockSchema, endTime: clockSchema }))
    .max(12),
});
const blockSchema = z.object({
  practitionerId: z.number().int().positive().nullish(),
  startDate: dateSchema,
  endDate: dateSchema,
  allDay: z.boolean(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  reason: z.string().trim().max(300, "Anledningen får ha högst 300 tecken."),
});

function calendarDate(value: string): number {
  const millis = Date.parse(value + "T00:00:00Z");
  if (
    !Number.isFinite(millis) ||
    new Date(millis).toISOString().slice(0, 10) !== value
  )
    throw new DomainError("Ange ett giltigt datum.");
  return millis;
}

function dateRange(
  startDate: string,
  endDate: string,
  now: number,
  maxDays: number,
) {
  const start = calendarDate(startDate);
  const end = calendarDate(endDate);
  const today = calendarDate(
    localDateTime(new Date(now).toISOString()).slice(0, 10),
  );
  if (start < today || end > today + 730 * DAY)
    throw new DomainError("Välj datum från idag och högst två år framåt.");
  if (end < start)
    throw new DomainError(
      "Slutdatum måste vara samma dag eller efter startdatum.",
    );
  if ((end - start) / DAY + 1 > maxDays)
    throw new DomainError(`Perioden får omfatta högst ${maxDays} dagar.`);
  return { start, end };
}

// A repeated clock time during autumn's DST transition must be chosen explicitly;
// these recurring rules have no offset field, so ambiguous boundaries are rejected.
function stockholmInstant(date: string, time: string): string {
  const value = `${date}T${time}`;
  const candidates = ["+01:00", "+02:00"]
    .map((offset) => new Date(value + ":00" + offset))
    .filter(
      (candidate) =>
        Number.isFinite(candidate.getTime()) &&
        localDateTime(candidate.toISOString()) === value,
    );
  if (candidates.length !== 1)
    throw new DomainError(
      `Klockslaget ${value.replace("T", " ")} är ogiltigt eller tvetydigt vid byte till sommar- eller vintertid. Välj ett annat klockslag.`,
    );
  return candidates[0].toISOString();
}

async function requireAdmin(actorId: number) {
  if ((await getUser(actorId))?.role !== "admin")
    throw new DomainError("Du har inte behörighet för denna åtgärd.");
}

type Interval = { start: string; end: string };
function mergeIntervals(intervals: Interval[]): Interval[] {
  const merged: Interval[] = [];
  for (const interval of intervals.sort((a, b) =>
    a.start.localeCompare(b.start),
  )) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      if (interval.end > previous.end) previous.end = interval.end;
    } else merged.push({ ...interval });
  }
  return merged;
}
function overlaps(interval: Interval, occupied: Interval[]): boolean {
  let low = 0;
  let high = occupied.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (occupied[middle].end <= interval.start) low = middle + 1;
    else high = middle;
  }
  return low < occupied.length && occupied[low].start < interval.end;
}

export async function getAvailabilitySchedules(): Promise<
  AvailabilitySchedule[]
> {
  return (
    await getDb()
      .prepare(
        "SELECT a.*,t.name AS treatment_name,p.name AS practitioner_name FROM availability_schedules a JOIN treatments t ON t.id=a.treatment_id JOIN practitioners p ON p.id=a.practitioner_id WHERE a.archived=0 ORDER BY a.start_date,a.id",
      )
      .all()
  ).map((row) => ({
    id: Number(row.id),
    treatmentId: Number(row.treatment_id),
    treatmentName: String(row.treatment_name),
    practitionerId: Number(row.practitioner_id),
    practitionerName: String(row.practitioner_name),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    weekdays: JSON.parse(String(row.weekdays)) as number[],
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    breaks: JSON.parse(String(row.breaks)) as AvailabilitySchedule["breaks"],
    createdAt: String(row.created_at),
    created: Number(row.created_count),
    skipped: Number(row.skipped_count),
  }));
}

export async function saveAvailabilitySchedule(
  actorId: number,
  input: AvailabilityScheduleInput,
): Promise<{ id: number; created: number; skipped: number; blocked: number }> {
  return transaction(async () => {
    await requireAdmin(actorId);
    const value = scheduleSchema.parse(input);
    const now = Date.now();
    const dates = dateRange(value.startDate, value.endDate, now, 90);
    if (new Set(value.weekdays).size !== value.weekdays.length)
      throw new DomainError("Välj varje veckodag endast en gång.");
    value.weekdays.sort((a, b) => a - b);
    if (value.startTime >= value.endTime)
      throw new DomainError(
        "Arbetsdagens sluttid måste vara efter starttiden.",
      );
    value.breaks.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let previousEnd = value.startTime;
    for (const pause of value.breaks) {
      if (
        pause.startTime >= pause.endTime ||
        pause.startTime < value.startTime ||
        pause.endTime > value.endTime
      )
        throw new DomainError(
          "Varje rast måste ha en sluttid efter starttiden och ligga inom arbetsdagen.",
        );
      if (pause.startTime < previousEnd)
        throw new DomainError("Rasterna får inte överlappa varandra.");
      previousEnd = pause.endTime;
    }
    const treatment = await getTreatment(value.treatmentId);
    if (!treatment || !treatment.active)
      throw new DomainError("Välj en aktiv behandling.");
    const practitioner = await getPractitioner(value.practitionerId);
    if (!practitioner || !practitioner.active)
      throw new DomainError("Välj en aktiv behandlare.");
    const segments: { startTime: string; endTime: string }[] = [];
    let segmentStart = value.startTime;
    for (const pause of value.breaks) {
      if (pause.startTime > segmentStart)
        segments.push({ startTime: segmentStart, endTime: pause.startTime });
      segmentStart = pause.endTime;
    }
    if (segmentStart < value.endTime)
      segments.push({ startTime: segmentStart, endTime: value.endTime });
    const candidates: Interval[] = [];
    let skipped = 0;
    let count = 0;
    for (let day = dates.start; day <= dates.end; day += DAY) {
      const weekday = new Date(day).getUTCDay() || 7;
      if (!value.weekdays.includes(weekday)) continue;
      const date = new Date(day).toISOString().slice(0, 10);
      // Validate the entire rule's boundaries even if a pause leaves no segment.
      for (const time of [
        value.startTime,
        value.endTime,
        ...value.breaks.flatMap((pause) => [pause.startTime, pause.endTime]),
      ])
        stockholmInstant(date, time);
      for (const segment of segments) {
        const start = Date.parse(stockholmInstant(date, segment.startTime));
        const end = Date.parse(stockholmInstant(date, segment.endTime));
        const duration = treatment.durationMinutes * MINUTE;
        for (
          let slotStart = start;
          slotStart + duration <= end;
          slotStart += duration
        ) {
          if (++count > MAX_CANDIDATES)
            throw new DomainError(
              "Schemat får skapa högst 2 000 tider. Välj en kortare period eller färre veckodagar.",
            );
          if (slotStart <= now) skipped++;
          else
            candidates.push({
              start: new Date(slotStart).toISOString(),
              end: new Date(slotStart + duration).toISOString(),
            });
        }
      }
    }
    if (!candidates.length)
      throw new DomainError(
        "Schemat ger inga framtida tider. Kontrollera veckodagar, arbetstider, raster och behandlingens längd.",
      );
    await expireBookings();
    const first = candidates[0].start;
    const last = candidates.at(-1)!.end;
    const occupiedRows = await getDb()
      .prepare(
        `SELECT start,end,treatment_id,'slot' AS kind FROM slots WHERE practitioner_id=? AND archived=0 AND start<? AND end>?
       UNION ALL SELECT start,end,treatment_id,'booking' AS kind FROM bookings WHERE practitioner_id=? AND status IN ('pending','confirmed','completed') AND start<? AND end>?
       UNION ALL SELECT start,end,NULL AS treatment_id,'block' AS kind FROM availability_blocks WHERE (practitioner_id IS NULL OR practitioner_id=?) AND start<? AND end>?`,
      )
      .all(
        value.practitionerId,
        last,
        first,
        value.practitionerId,
        last,
        first,
        value.practitionerId,
        last,
        first,
      );
    const occupied = mergeIntervals(
      occupiedRows
        .filter((row) => row.kind !== "block")
        .map((row) => ({ start: String(row.start), end: String(row.end) })),
    );
    const blockedIntervals = mergeIntervals(
      occupiedRows
        .filter((row) => row.kind === "block")
        .map((row) => ({ start: String(row.start), end: String(row.end) })),
    );
    const available = candidates.filter(
      (candidate) => !overlaps(candidate, occupied),
    );
    skipped += candidates.length - available.length;
    const created = available.length;
    const blocked = available.filter((candidate) =>
      overlaps(candidate, blockedIntervals),
    ).length;
    if (!created) {
      const duplicates = new Set(
        occupiedRows
          .filter(
            (row) =>
              row.kind === "slot" &&
              Number(row.treatment_id) === value.treatmentId,
          )
          .map((row) => `${row.start}/${row.end}`),
      );
      if (
        !candidates.every((candidate) =>
          duplicates.has(`${candidate.start}/${candidate.end}`),
        )
      )
        throw new DomainError(
          "Schemat ger inga nya tider eftersom perioden överlappar bokningar eller andra tider.",
        );
      const existing = await getDb()
        .prepare(
          "SELECT id FROM availability_schedules WHERE archived=0 AND treatment_id=? AND practitioner_id=? AND start_date=? AND end_date=? AND weekdays=? AND start_time=? AND end_time=? AND breaks=? ORDER BY id LIMIT 1",
        )
        .get(
          value.treatmentId,
          value.practitionerId,
          value.startDate,
          value.endDate,
          JSON.stringify(value.weekdays),
          value.startTime,
          value.endTime,
          JSON.stringify(value.breaks),
        );
      if (existing)
        return { id: Number(existing.id), created, skipped, blocked };
    }
    const result = await getDb()
      .prepare(
        "INSERT INTO availability_schedules(treatment_id,practitioner_id,start_date,end_date,weekdays,start_time,end_time,breaks,created_count,skipped_count,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run(
        value.treatmentId,
        value.practitionerId,
        value.startDate,
        value.endDate,
        JSON.stringify(value.weekdays),
        value.startTime,
        value.endTime,
        JSON.stringify(value.breaks),
        created,
        skipped,
        new Date(now).toISOString(),
      );
    const id = Number(result.lastInsertRowid);
    // Bounded multi-row inserts avoid one network round-trip per generated slot.
    for (let index = 0; index < available.length; index += 250) {
      const chunk = available.slice(index, index + 250);
      await getDb()
        .prepare(
          `INSERT INTO slots(treatment_id,practitioner_id,start,end,schedule_id) VALUES ${chunk.map(() => "(?,?,?,?,?)").join(",")}`,
        )
        .run(
          ...chunk.flatMap((slot) => [
            value.treatmentId,
            value.practitionerId,
            slot.start,
            slot.end,
            id,
          ]),
        );
    }
    return { id, created, skipped, blocked };
  });
}

export async function deleteAvailabilitySchedule(
  actorId: number,
  id: number,
): Promise<void> {
  await transaction(async () => {
    await requireAdmin(actorId);
    z.number().int().positive().parse(id);
    await expireBookings();
    if (
      !(await getDb()
        .prepare(
          "SELECT id FROM availability_schedules WHERE id=? AND archived=0",
        )
        .get(id))
    )
      throw new DomainError("Schemat finns inte.");
    await getDb()
      .prepare(
        `UPDATE slots SET archived=1 WHERE schedule_id=? AND archived=0 AND start>?
       AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.practitioner_id=slots.practitioner_id AND b.status IN ('pending','confirmed','completed') AND b.start<slots.end AND b.end>slots.start)`,
      )
      .run(id, new Date().toISOString());
    await getDb()
      .prepare("UPDATE availability_schedules SET archived=1 WHERE id=?")
      .run(id);
  });
}

export async function getAvailabilityBlocks(
  options: { futureOnly?: boolean } = {},
): Promise<AvailabilityBlock[]> {
  return (
    await getDb()
      .prepare(
        `SELECT a.*,p.name AS practitioner_name FROM availability_blocks a LEFT JOIN practitioners p ON p.id=a.practitioner_id ${options.futureOnly ? "WHERE a.end>?" : ""} ORDER BY a.start,a.id`,
      )
      .all(...(options.futureOnly ? [new Date().toISOString()] : []))
  ).map((row) => ({
    id: Number(row.id),
    practitionerId:
      row.practitioner_id == null ? null : Number(row.practitioner_id),
    practitionerName:
      row.practitioner_name == null ? null : String(row.practitioner_name),
    start: String(row.start),
    end: String(row.end),
    allDay: !!row.all_day,
    reason: String(row.reason),
    createdAt: String(row.created_at),
  }));
}

export async function saveAvailabilityBlock(
  actorId: number,
  input: AvailabilityBlockInput,
): Promise<number> {
  return transaction(async () => {
    await requireAdmin(actorId);
    const value = blockSchema.parse(input);
    if (
      value.practitionerId != null &&
      !(await getPractitioner(value.practitionerId))
    )
      throw new DomainError("Behandlaren finns inte.");
    const now = Date.now();
    const dates = dateRange(value.startDate, value.endDate, now, 731);
    const start = stockholmInstant(
      value.startDate,
      value.allDay ? "00:00" : clockSchema.parse(value.startTime),
    );
    const end = value.allDay
      ? stockholmInstant(
          new Date(dates.end + DAY).toISOString().slice(0, 10),
          "00:00",
        )
      : stockholmInstant(value.endDate, clockSchema.parse(value.endTime));
    if (end <= start || Date.parse(end) <= now)
      throw new DomainError(
        "Spärren måste ha en framtida sluttid efter starttiden.",
      );
    await expireBookings();
    if (
      await getDb()
        .prepare(
          "SELECT id FROM bookings WHERE (? IS NULL OR practitioner_id=?) AND status IN ('pending','confirmed','completed') AND start<? AND end>?",
        )
        .get(
          value.practitionerId ?? null,
          value.practitionerId ?? null,
          end,
          start,
        )
    )
      throw new DomainError(
        "Spärren överlappar en bokning. Hantera bokningen innan du spärrar perioden.",
      );
    const result = await getDb()
      .prepare(
        "INSERT INTO availability_blocks(practitioner_id,start,end,all_day,reason,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        value.practitionerId ?? null,
        start,
        end,
        value.allDay ? 1 : 0,
        value.reason,
        new Date(now).toISOString(),
      );
    return Number(result.lastInsertRowid);
  });
}

export async function deleteAvailabilityBlock(
  actorId: number,
  id: number,
): Promise<void> {
  await transaction(async () => {
    await requireAdmin(actorId);
    z.number().int().positive().parse(id);
    if (
      !(
        await getDb()
          .prepare("DELETE FROM availability_blocks WHERE id=?")
          .run(id)
      ).changes
    )
      throw new DomainError("Spärren finns inte.");
  });
}
