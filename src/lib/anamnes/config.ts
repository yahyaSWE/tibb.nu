import "server-only";
import { isIP } from "node:net";
import { createHash } from "node:crypto";

const enabled = (key: string) => process.env[key] === "1";
const activationReviewed = () => enabled("ANAMNES_PRIVACY_REVIEWED") && enabled("ANAMNES_CLINICAL_REVIEWED") && enabled("ANAMNES_REGULATORY_REVIEWED");
const consentVersion = (...values: unknown[]) => createHash("sha256").update(JSON.stringify(values)).digest("hex");
const therapistEmails = () => (process.env.ANAMNES_THERAPIST_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
export function anamnesRetentionDays() {
  const value = Number(process.env.ANAMNES_RETENTION_DAYS ?? 30);
  return Number.isInteger(value) && value >= 1 && value <= 90 ? value : 30;
}
export function anamnesAiDailyLimit() {
  const value = Number(process.env.ANAMNES_AI_DAILY_LIMIT ?? 100);
  return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : 100;
}
export function anamnesEncryptionKey(): Buffer | null {
  const raw = process.env.ANAMNES_STORAGE_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, "hex");
}
export function anamnesAiConfig() {
  const provider = process.env.ANAMNES_AI_PROVIDER?.trim() ?? "";
  const model = process.env.ANAMNES_AI_MODEL?.trim() ?? "";
  const apiKey = process.env.ANAMNES_AI_API_KEY?.trim() ?? "";
  const privacyNotice = process.env.ANAMNES_AI_PRIVACY_NOTICE?.trim() ?? "";
  // Only an explicit server-controlled provider endpoint is supported. Never
  // use a submitted URL: it could disclose health information or credentials.
  const endpoint = provider === "openai" ? "https://api.openai.com/v1/responses" : provider === "responses-compatible" ? configuredCompatibleEndpoint() : null;
  const providerLabel = provider === "openai" ? "OpenAI" : endpoint ? new URL(endpoint).hostname : "AI";
  const available = enabled("ANAMNES_AI_ENABLED") && activationReviewed() && !!endpoint && !!model && !!apiKey && privacyNotice.length >= 30;
  // Updated vocabulary, composite criteria and report fields require a fresh
  // session choice. Pre-upgrade in-flight receipts fail closed; stored original
  // reports are still read from their encrypted snapshots, never recomputed.
  return { available, provider, providerLabel, model, apiKey, privacyNotice, endpoint, consentVersion: consentVersion("ai-v8-confirmed-observations-differential", provider, endpoint, model, privacyNotice) };
}
function configuredCompatibleEndpoint(): string | null {
  try {
    const url = new URL(process.env.ANAMNES_AI_ENDPOINT ?? "");
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443") || isIP(host) || host === "localhost" || !host.includes(".") || /\.(localhost|local|internal|test|invalid)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}
export function anamnesSubmissionsAvailable() {
  return enabled("ANAMNES_SUBMISSIONS_ENABLED") && activationReviewed() && !!anamnesEncryptionKey() && therapistEmails().length > 0 && (process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE?.trim().length ?? 0) >= 30;
}
export function anamnesSubmissionConsentVersion() {
  return consentVersion("clinic-submission-v3-consultation-context", "Joart Group AB 559363-3893", process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE?.trim(), anamnesRetentionDays(), therapistEmails().sort());
}
export function getAnamnesConfigStatus() {
  const ai = anamnesAiConfig();
  const privacyReviewed = enabled("ANAMNES_PRIVACY_REVIEWED");
  const aiMissing = [!enabled("ANAMNES_AI_ENABLED") && "ANAMNES_AI_ENABLED=1", !privacyReviewed && "ANAMNES_PRIVACY_REVIEWED=1", !["openai", "responses-compatible"].includes(ai.provider) && "ANAMNES_AI_PROVIDER=openai eller responses-compatible", !ai.endpoint && ai.provider === "responses-compatible" && "ANAMNES_AI_ENDPOINT (offentlig HTTPS Responses-endpoint)", !ai.model && "ANAMNES_AI_MODEL", !ai.apiKey && "ANAMNES_AI_API_KEY", ai.privacyNotice.length < 30 && "ANAMNES_AI_PRIVACY_NOTICE (minst 30 tecken)"].filter((value): value is string => !!value);
  const reviewsMissing = [!enabled("ANAMNES_CLINICAL_REVIEWED") && "ANAMNES_CLINICAL_REVIEWED=1", !enabled("ANAMNES_REGULATORY_REVIEWED") && "ANAMNES_REGULATORY_REVIEWED=1"].filter((value): value is string => !!value);
  aiMissing.push(...reviewsMissing);
  const submissionsMissing = [!enabled("ANAMNES_SUBMISSIONS_ENABLED") && "ANAMNES_SUBMISSIONS_ENABLED=1", !privacyReviewed && "ANAMNES_PRIVACY_REVIEWED=1", !anamnesEncryptionKey() && "ANAMNES_STORAGE_KEY (64 hextecken)", !therapistEmails().length && "ANAMNES_THERAPIST_EMAILS", (process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE?.trim().length ?? 0) < 30 && "ANAMNES_SUBMISSION_PRIVACY_NOTICE (minst 30 tecken)", ...reviewsMissing].filter((value): value is string => !!value);
  return {
    ai: { available: ai.available, consentVersion: ai.consentVersion, dailyLimit: anamnesAiDailyLimit(), missing: aiMissing, providerLabel: ai.available ? `${ai.providerLabel} (${ai.model})` : "AI är avstängd", privacyNotice: ai.available ? ai.privacyNotice : "Svaren analyseras med den lokala regelmodellen. Inga hälsouppgifter skickas till en AI-leverantör." },
    submissions: { available: anamnesSubmissionsAvailable(), consentVersion: anamnesSubmissionConsentVersion(), storageReady: !!anamnesEncryptionKey(), missing: submissionsMissing, retentionDays: anamnesRetentionDays(), notice: anamnesSubmissionsAvailable() ? process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE!.trim() : "Inskickning är avstängd. Svaren stannar i webbläsaren om du inte uttryckligen väljer AI-analys." },
    referencesEnabled: true as const,
  };
}
