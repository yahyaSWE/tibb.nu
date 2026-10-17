import "server-only";
import { z } from "zod";
import { getDb } from "../database";
import type { User } from "../types";
import { AnamnesError } from "./http";

const AnalysisModeSchema = z.enum(["rules", "ai"]);
export type AnamnesAnalysisMode = z.infer<typeof AnalysisModeSchema>;
const analysisModeKey = "anamnes_analysis_mode";

export async function getAnamnesAnalysisMode(): Promise<AnamnesAnalysisMode> {
  try {
    const row = await getDb().prepare("SELECT value FROM app_meta WHERE key=?").get(analysisModeKey);
    const value = AnalysisModeSchema.safeParse(row?.value);
    // A missing, corrupt or unreadable setting must never start provider calls.
    return value.success ? value.data : "rules";
  } catch {
    return "rules";
  }
}

export async function saveAnamnesAnalysisMode(actor: User, input: unknown): Promise<AnamnesAnalysisMode> {
  if (actor?.role !== "admin") throw new AnamnesError("Du har inte behörighet till detta.", 403);
  const value = AnalysisModeSchema.safeParse(input);
  if (!value.success) throw new AnamnesError("Välj poängbaserad eller AI-baserad analys.");
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(analysisModeKey, value.data);
  return value.data;
}
