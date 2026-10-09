import { DomainError } from "./db";
import { localDateTime, stockholmToIso } from "./time";

export function shopLocalDateTime(value: string): string | null {
  if (!value.trim()) return null;
  let iso: string;
  try { iso = stockholmToIso(value); }
  catch (error) { throw new DomainError(error instanceof Error ? error.message : "Ange ett giltigt datum och klockslag i svensk tid."); }
  const matches = ["+02:00", "+01:00"].map(offset => new Date(value + ":00" + offset))
    .filter(date => !Number.isNaN(date.getTime()) && localDateTime(date.toISOString()) === value);
  if (matches.length !== 1) throw new DomainError("Klockslaget förekommer två gånger när svensk tid ställs om. Välj ett annat klockslag.");
  return iso;
}

export function shopInteger(value: string, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) throw new DomainError(`Ange ${label} som ett heltal.`);
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new DomainError(`Kontrollera ${label}. Tillåtet intervall är ${minimum}–${maximum}.`);
  return number;
}

export function shopMoney(value: string, label: string, maximumOre = 100_000_000): number {
  const raw = value.trim().replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) throw new DomainError(`Ange ${label} i kronor, med högst två decimaler.`);
  const ore = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(ore) || ore > maximumOre) throw new DomainError(`Beloppet för ${label} är för stort.`);
  return ore;
}
