import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getDb, transaction } from "./database";
import { emailConfigurationStatus, requireEmailConfiguration, sendEmail } from "./email-provider";
import { renderEmailTemplate } from "./email-template";
import { tokenHash } from "./security";

const recipient = "kontakt@tibb.nu";
const maxAttempts = 5;
const retryWindow = 23 * 60 * 60 * 1000;
type IntakeKind = "anamnes" | "self-test";

export async function queueIntakeEmail(reference: string, kind: IntakeKind, createdAt: string) {
  await getDb().prepare("INSERT INTO intake_email_outbox(submission_id,kind,next_attempt_at) VALUES(?,?,?)")
    .run(reference, kind, createdAt);
}

export function scheduleIntakeEmail(reference: string) {
  if (!emailConfigurationStatus().configured) return;
  after(async () => {
    try {
      await dispatchIntakeEmails({ reference });
    } catch {
      console.error("Intake email outbox dispatch failed");
    }
  });
}

function intakeMessage(kind: IntakeKind, origin: string) {
  const title = kind === "anamnes" ? "Ny inskickad anamnes" : "Nytt inskickat självtest med fem faser";
  const text = "Ett nytt underlag har sparats hos Tibb.nu. Logga in som behörig behandlare för att läsa det.\n\n" +
    new URL("/admin/inskickade-underlag", origin);
  return { subject: title, text, html: renderEmailTemplate({ title, text, origin }) };
}

const due = "((status='pending' AND next_attempt_at<=?) OR (status='sending' AND lease_until<=?))";
const activeSubmission = `((kind='anamnes' AND EXISTS (
  SELECT 1 FROM anamnes_cases c WHERE c.id=submission_id AND c.expires_at>?
)) OR (kind='self-test' AND EXISTS (
  SELECT 1 FROM self_test_cases c WHERE c.id=submission_id AND c.expires_at>?
)))`;

async function claim(reference: string, config: ReturnType<typeof requireEmailConfiguration>) {
  return transaction(async () => {
    const now = new Date().toISOString();
    const job = await getDb().prepare(`SELECT * FROM intake_email_outbox WHERE submission_id=? AND ${due} AND ${activeSubmission}`)
      .get(reference, now, now, now, now);
    if (!job) return null;
    const attempts = Number(job.attempts);
    if (attempts >= maxAttempts || (job.first_attempt_at && Date.parse(String(job.first_attempt_at)) + retryWindow <= Date.now())) {
      await getDb().prepare("UPDATE intake_email_outbox SET status='failed',lease_token=NULL,lease_until=NULL WHERE submission_id=?").run(reference);
      return null;
    }
    const { subject, text, html } = attempts === 0
      ? intakeMessage(job.kind as IntakeKind, config.origin)
      : { subject: String(job.subject), text: String(job.body), html: String(job.html) };
    const from = String(job.sender || config.from);
    const lease = randomUUID();
    await getDb().prepare(`UPDATE intake_email_outbox SET status='sending',attempts=attempts+1,
      sender=?,subject=?,body=?,html=?,first_attempt_at=COALESCE(first_attempt_at,?),lease_token=?,lease_until=?
      WHERE submission_id=?`).run(from, subject, text, html, now, lease, new Date(Date.now() + 90000).toISOString(), reference);
    return { from, subject, text, html, lease, attempts: attempts + 1 };
  });
}

export async function dispatchIntakeEmails(options: { reference?: string; limit?: number } = {}) {
  const result = { configured: emailConfigurationStatus().configured, sent: 0, failed: 0 };
  if (!result.configured) return result;
  const config = requireEmailConfiguration();
  const now = new Date().toISOString();
  const jobs = await getDb().prepare(`SELECT submission_id FROM intake_email_outbox WHERE ${due} AND ${activeSubmission}
    ${options.reference ? "AND submission_id=?" : ""} ORDER BY next_attempt_at,submission_id LIMIT ?`)
    .all(now, now, now, now, ...(options.reference ? [options.reference] : []), Math.max(1, Math.min(5, options.limit ?? 5)));
  for (const row of jobs) {
    const reference = String(row.submission_id);
    const job = await claim(reference, config);
    if (!job) continue;
    try {
      await sendEmail({ ...job, to: recipient, idempotencyKey: `intake-${tokenHash(reference)}` });
      await getDb().prepare("UPDATE intake_email_outbox SET status='sent',sent_at=?,lease_token=NULL,lease_until=NULL WHERE submission_id=? AND lease_token=?")
        .run(new Date().toISOString(), reference, job.lease);
      result.sent++;
    } catch {
      const nextAttempt = new Date(Date.now() + 60000 * 2 ** (job.attempts - 1)).toISOString();
      await getDb().prepare("UPDATE intake_email_outbox SET status=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE submission_id=? AND lease_token=?")
        .run(job.attempts >= maxAttempts ? "failed" : "pending", nextAttempt, reference, job.lease);
      result.failed++;
    }
  }
  return result;
}
