export const TIME_ZONE = "Europe/Stockholm";
const localFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function localDateTime(iso: string) {
  return localFormat.format(new Date(iso)).replace(" ", "T");
}
export function stockholmToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error("Ange ett giltigt datum och klockslag.");
  const candidates = ["+02:00", "+01:00"]
    .map((offset) => new Date(value + ":00" + offset))
    .filter(
      (date) =>
        !Number.isNaN(date.getTime()) &&
        localDateTime(date.toISOString()) === value,
    );
  if (!candidates.length)
    throw new Error("Klockslaget finns inte i svensk tid. Välj en annan tid.");
  return candidates[0].toISOString();
}
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    dateStyle: "long",
  }).format(new Date(iso));
}
export function formatMoney(priceOre: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: priceOre % 100 === 0 ? 0 : 2,
  }).format(priceOre / 100);
}
