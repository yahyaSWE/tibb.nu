"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Send, X } from "lucide-react";
import { IntakeContactFields } from "@/components/intake/contact-fields";
import type { IntakeContact } from "@/lib/intake-contact";
import styles from "./tcm-anamnes.module.css";

type Submission = { reference: string; expiresAt: string };
type Props = {
  config: { available: boolean; consentVersion?: string; retentionDays: number; notice: string };
  contact: IntakeContact;
  onContactChange: (contact: IntakeContact) => void;
  accepted: boolean;
  onAccepted: (accepted: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  error: string;
  submission: Submission | null;
  preview: ReactNode;
  source: "ai" | "rules";
  hasReceipt: boolean;
  onCopy: () => void;
  copied: boolean;
};

export function AnamnesSubmissionPanel({ config, contact, onContactChange, accepted, onAccepted, onSubmit, busy, error, submission, preview, source, hasReceipt, onCopy, copied }: Props) {
  const [open, setOpen] = useState(false);
  const [cardVisible, setCardVisible] = useState(true);
  const cardRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const statusRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const available = config.available && !!config.consentVersion;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (submission) dialogTitleRef.current?.focus();
      else dialog.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open, available]);
  useEffect(() => { if (open && error) errorRef.current?.focus(); }, [open, error]);
  useEffect(() => { if (open && submission) dialogTitleRef.current?.focus(); }, [submission, open]);
  useEffect(() => {
    if (!available || !cardRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setCardVisible(entry.isIntersecting));
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [available]);

  function closed() {
    setOpen(false);
    if (submission) requestAnimationFrame(() => {
      statusRef.current?.focus({ preventScroll: true });
      cardRef.current?.scrollIntoView({ block: "start" });
    });
  }

  if (!available) return <section className={styles.sendCallout} aria-labelledby="anamnes-send-title">
    <h3 id="anamnes-send-title">Ta med ditt underlag till behandlaren</h3>
    <p>Digital inskickning är inte tillgänglig just nu. Kopiera sammanfattningen och ta med den till din konsultation.</p>
    <button type="button" className={styles.secondary} onClick={onCopy}>{copied ? "Sammanfattningen är kopierad" : "Kopiera underlaget"}</button>
  </section>;

  return <>
    <section ref={cardRef} className={`${styles.sendCallout} ${submission ? styles.sendComplete : ""}`} aria-labelledby="anamnes-send-title">
      <p className={styles.sendStatus}>{submission ? <CheckCircle2 size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}{submission ? "Inskickat" : "Inte inskickad än"}</p>
      <h3 id="anamnes-send-title" ref={statusRef} tabIndex={-1}>{submission ? "Din anamnes är skickad" : "Sista steget: skicka till behandlaren"}</h3>
      <p>{submission ? "Underlaget har tagits emot. Behandlaren kan nu läsa det inför ditt besök." : "Dina svar är klara, men behandlaren har inte fått dem ännu. Lägg till namn och e-postadress och skicka in när du är redo."}</p>
      {submission ? <details className={styles.reportDetails}><summary>Din inskickningsbekräftelse</summary><SubmissionReceipt submission={submission} /></details>
        : <button type="button" className={styles.primary} disabled={busy} onClick={() => setOpen(true)}><Send size={17} aria-hidden="true" />Skicka till behandlaren</button>}
      {!submission && <p className={styles.smallNote}>Du kan granska ditt underlag längre ned. Inskickningen är frivillig och kräver inget elevkonto.</p>}
    </section>
    <dialog ref={dialogRef} onClose={closed} className={styles.sendDialog} aria-labelledby="anamnes-send-dialog-title">
      <button type="button" className={styles.dialogClose} aria-label="Stäng inskickningsformuläret" onClick={() => dialogRef.current?.close()}><X size={22} aria-hidden="true" /></button>
      <h3 id="anamnes-send-dialog-title" ref={dialogTitleRef} tabIndex={-1}>{submission ? "Din anamnes är skickad" : "Skicka till behandlaren"}</h3>
      {submission ? <div className={styles.sendReceipt} role="status">
        <CheckCircle2 size={30} aria-hidden="true" /><p><strong>Underlaget har tagits emot.</strong> Du behöver inte skicka igen.</p>
        <SubmissionReceipt submission={submission} />
        <button type="button" className={styles.primary} onClick={() => dialogRef.current?.close()}>Till mitt underlag</button>
      </div> : <>
        <p>Fyll i dina kontaktuppgifter så kan behandlaren koppla underlaget till dig. Telefon är valfritt.</p>
        <form onSubmit={onSubmit} className={styles.sendForm} aria-busy={busy}>
          <IntakeContactFields prefix="anamnes-contact" value={contact} onChange={onContactChange} disabled={busy} />
          <details className={styles.reportDetails}><summary>Granska vad du skickar</summary>{preview}</details>
          <details className={styles.reportDetails} id="anamnes-send-storage"><summary>Om inskickningen och lagringen</summary><p>{config.notice}</p><p>Underlaget lagras krypterat i högst {config.retentionDays} dagar och kan läsas av behörig behandlare.</p><p>{source === "ai" && hasReceipt ? "Den AI-assisterade originalrapporten följer med utan ett nytt AI-anrop." : source === "ai" ? "AI-rapporten saknar ett giltigt sparningsunderlag. Vid inskickning skapas därför en regelbaserad rapport från dina svar." : "En regelbaserad rapport skapas från dina svar med den aktuella katalogen."}</p></details>
          <label className={`${styles.option} ${styles.checkbox} ${styles.sendConsent}`}><input type="checkbox" name="sendConsent" required checked={accepted} onChange={event => onAccepted(event.target.checked)} disabled={busy} aria-describedby="anamnes-send-storage" /><span>Jag har läst informationen och vill skicka min beskrivning, mina svar, kompletteringar och kontaktuppgifter till Tibb.nu inför en konsultation.</span></label>
          {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy}><Send size={17} aria-hidden="true" />{busy ? "Skickar din anamnes…" : "Skicka min anamnes till behandlaren"}</button>
          <p className={styles.smallNote}>Vänta tills du ser bekräftelsen ”Din anamnes är skickad”.</p>
        </form>
      </>}
    </dialog>
    {!submission && !open && !cardVisible && <aside className={styles.sendShortcut} aria-label="Skicka din anamnes">
      <span><strong>Svaren är klara</strong><small>Återstår att skicka in</small></span>
      <button type="button" className={styles.primary} disabled={busy} onClick={() => setOpen(true)}><Send size={17} aria-hidden="true" />Skicka till behandlaren</button>
    </aside>}
  </>;
}

function SubmissionReceipt({ submission }: { submission: Submission }) {
  return <><p>Din referens: <code>{submission.reference}</code></p><p>Behandlaren kan läsa underlaget till {new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "Europe/Stockholm" }).format(new Date(submission.expiresAt))}. Spara referensen om du behöver kontakta oss.</p></>;
}
