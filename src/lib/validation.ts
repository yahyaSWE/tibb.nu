import { z } from "zod";
import { DomainError } from "./db";
export const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min, "Fyll i alla obligatoriska fält.")
    .max(max, "Texten är för lång.");
export const emailSchema = z
  .string()
  .trim()
  .email("Ange en giltig e-postadress.")
  .max(254)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, "Lösenordet ska innehålla minst 12 tecken.")
  .max(128, "Lösenordet får ha högst 128 tecken.");
export const signupSchema = z.object({
  name: text(100, 2),
  email: emailSchema,
  password: passwordSchema,
});
export const bookingSchema = z.object({
  slotId: z.coerce.number().int().positive(),
  name: text(100, 2),
  email: emailSchema,
  phone: text(30),
  paymentMethod: z.enum(["onsite", "stripe"]),
  consent: z.literal("on", {
    error: "Godkänn att kontaktuppgifterna används för bokningen.",
  }),
});
export function money(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw))
    throw new DomainError("Ange ett pris i kronor, med högst två decimaler.");
  const ore = Math.round(Number(raw) * 100);
  if (ore > 10_000_000)
    throw new DomainError("Priset får vara högst 100 000 kronor.");
  return ore;
}
export function slug(value: string, title: string) {
  const result = (value || title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  if (!result)
    throw new DomainError("Ange en giltig webbadress för innehållet.");
  return result;
}
export function safeUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
    return url.toString();
  } catch {
    throw new DomainError(
      "Länkar till video och material ska börja med https://.",
    );
  }
}
export function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
export function idField(form: FormData, name = "id") {
  return z.coerce
    .number()
    .int()
    .positive("Ett giltigt ID behövs.")
    .parse(field(form, name));
}
