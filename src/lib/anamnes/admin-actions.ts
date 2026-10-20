"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/db";
import { z } from "zod";
import { saveFormulaCatalogEntry, deleteFormulaCatalogEntry } from "./catalog";
import { deleteAnamnesCase, reviewAnamnesCase, therapistAccess } from "./cases";
import { AnamnesError } from "./http";
import { saveAnamnesAnalysisMode } from "./settings";

export type AnamnesAdminState = { error?: string; success?: string; revision?: number; updatedAt?: string; analysisMode?: "rules" | "ai" };

function friendlyError(error: unknown) {
  if (error instanceof z.ZodError) return "Kontrollera fälten. Några värden saknas eller har fel format.";
  if (error instanceof DomainError || error instanceof AnamnesError) return error.message;
  // Never put intake, provider errors, submitted values or raw database errors in URLs/logs.
  return "Åtgärden kunde inte slutföras. Kontrollera inställningarna och försök igen.";
}

export async function saveAnamnesAnalysisModeAction(_state: AnamnesAdminState, form: FormData): Promise<AnamnesAdminState> {
  const actor = await requireAdmin();
  try {
    const analysisMode = await saveAnamnesAnalysisMode(actor, form.get("analysisMode"));
    revalidatePath("/admin/anamnes");
    revalidatePath("/anamnes");
    return { analysisMode, success: analysisMode === "rules" ? "Poängbaserad anamnes har valts. Nya analyser använder ingen extern AI." : "AI-assisterad anamnes har valts. AI används när konfigurationen är klar och besökaren har samtyckt; annars används poänganalysen." };
  } catch (error) { return { error: friendlyError(error) }; }
}

export async function saveAnamnesFormulaAction(_state: AnamnesAdminState, form: FormData): Promise<AnamnesAdminState> {
  const actor = await requireAdmin();
  try {
    const json = form.get("formula");
    if (typeof json !== "string" || json.length > 120_000) return { error: "Formelns uppgifter är för stora eller saknas." };
    const saved = await saveFormulaCatalogEntry(actor, JSON.parse(json));
    revalidatePath("/admin/anamnes/formler");
    revalidatePath("/anamnes");
    return { success: "Formeln har sparats. Bara aktiva formler deltar i nya jämförelser.", updatedAt: saved.updatedAt };
  } catch (error) { return { error: friendlyError(error) }; }
}

export async function deleteAnamnesFormulaAction(_state: AnamnesAdminState, form: FormData): Promise<AnamnesAdminState> {
  const actor = await requireAdmin();
  try {
    await deleteFormulaCatalogEntry(actor, String(form.get("id") || ""), String(form.get("updatedAt") || ""));
    revalidatePath("/admin/anamnes/formler");
    revalidatePath("/anamnes");
    return { success: "Formeln har tagits bort från katalogen." };
  } catch (error) { return { error: friendlyError(error) }; }
}

export async function reviewAnamnesAction(_state: AnamnesAdminState, form: FormData): Promise<AnamnesAdminState> {
  const actor = await requireAdmin();
  if (!therapistAccess(actor)) return { error: "Ditt konto saknar behörighet för anamnesärenden." };
  try {
    const expectedRevision = Number(form.get("expectedRevision"));
    await reviewAnamnesCase(actor, String(form.get("id") || ""), {
      expectedRevision,
      notes: String(form.get("notes") || ""),
      tongueNotes: String(form.get("tongueNotes") || ""),
      pulseNotes: String(form.get("pulseNotes") || ""),
      corrections: String(form.get("corrections") || ""),
      finalAssessment: String(form.get("finalAssessment") || ""),
      selectedPrimaryPatternId: form.get("selectedPrimaryPatternId") || null,
      selectedSecondaryPatternIds: form.getAll("selectedSecondaryPatternIds"),
      selectedFormulaId: form.get("selectedFormulaId") || null,
      formulaNotes: String(form.get("formulaNotes") || ""),
    });
    revalidatePath("/admin/anamnes/arenden", "layout");
    return { success: "Din bedömning har sparats separat från ursprungsrapporten.", revision: expectedRevision + 1 };
  } catch (error) { return { error: friendlyError(error) }; }
}

export async function deleteAnamnesAction(_state: AnamnesAdminState, form: FormData): Promise<AnamnesAdminState> {
  const actor = await requireAdmin();
  if (!therapistAccess(actor)) return { error: "Ditt konto saknar behörighet för anamnesärenden." };
  if (form.get("confirm") !== "yes") return { error: "Bekräfta att anamnesen ska raderas." };
  try {
    await deleteAnamnesCase(actor, String(form.get("id") || ""));
    revalidatePath("/admin/anamnes/arenden");
    return { success: "Anamnesen har raderats." };
  } catch (error) { return { error: friendlyError(error) }; }
}
