import { z } from "zod";
import { DomainError } from "./db";

export function shopAdminError(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Kontrollera fälten och försök igen.";
  if (error instanceof Error && /UNIQUE constraint|SQLITE_CONSTRAINT_UNIQUE/i.test(error.message)) return "Namnet eller koden används redan. Välj ett annat.";
  console.error("Tibb shop admin action failed", error instanceof Error ? error.name : "UnknownError");
  return "Det gick inte att spara. Din inmatning finns kvar. Försök igen.";
}
