"use client";
import { useEffect, useRef, useState } from 'react';
import { AnamnesDraftSchema, EncryptedAnamnesDraftStore, type AnamnesDraft } from '@/lib/anamnes/draft';
import { browserDraftStorage } from '@/lib/anamnes/draft-browser';
import { hasConsultationDetails } from '@/lib/anamnes/consultation';

export function useAnamnesDraft(value: AnamnesDraft, suspended = false) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [available, setAvailable] = useState<{ draft: AnamnesDraft; expiresAt: number } | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [clearing, setClearing] = useState(false);
  const store = useRef<EncryptedAnamnesDraftStore | null>(null);
  const latest = useRef(value);
  const active = useRef(false);
  const saved = useRef('');
  const erasedSnapshot = useRef('');
  const generation = useRef(0);
  latest.current = value;
  // A pending saved draft must not be overwritten by the blank starting form.
  active.current = ready && enabled && !available && !suspended && !clearing;
  const fingerprint = JSON.stringify(value);

  useEffect(() => {
    let cancelled = false;
    try { store.current ??= new EncryptedAnamnesDraftStore(browserDraftStorage()); }
    catch {
      setReady(true); setEnabled(false);
      setMessage('Den här webbläsaren kan inte spara utkast. Du kan fylla i anamnesen som vanligt.');
      return;
    }
    void store.current.load().then(result => {
      if (!cancelled) { setAvailable(result); setReady(true); }
    }).catch(() => {
      if (!cancelled) {
        setReady(true); setEnabled(false);
        setMessage('Utkastet kunde inte läsas. Dina nya svar kan fortfarande användas här.');
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function persist() {
    if (!active.current || !store.current) return;
    const serializedValue = JSON.stringify(latest.current);
    // Erasing a saved draft must not immediately save the same open answers again.
    if (serializedValue === erasedSnapshot.current || serializedValue === saved.current) return;
    const parsed = AnamnesDraftSchema.safeParse(latest.current);
    if (!parsed.success) {
      setMessage('Utkastet sparas när fälten innehåller giltiga värden. Dina svar finns kvar här.');
      return;
    }
    const draft = parsed.data;
    if (!draft.narrative && !Object.keys(draft.answers).length && !hasConsultationDetails(draft.consultation)) {
      if (saved.current) await clear();
      return;
    }
    const run = generation.current;
    setSaving(true);
    try {
      const expiry = await store.current.save(draft);
      if (run !== generation.current || !active.current) return;
      if (expiry) { saved.current = serializedValue; setExpiresAt(expiry); setMessage(''); }
    } catch {
      if (run !== generation.current) return;
      store.current?.cancelPendingSaves();
      active.current = false; setEnabled(false);
      setMessage('Utkastet kunde inte sparas, till exempel för att lagringen är full eller en annan flik har ändrat det. Dina aktuella svar finns kvar här. Radera det sparade utkastet för att försöka igen.');
    } finally { if (run === generation.current) setSaving(false); }
  }
  useEffect(() => {
    if (!ready || !enabled || available || suspended || clearing) return;
    const timer = setTimeout(() => void persist(), 250);
    return () => clearTimeout(timer);
  }, [fingerprint, ready, enabled, available, suspended, clearing]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void persist(); };
    const pageHide = () => { void persist(); };
    document.addEventListener('visibilitychange', flush); window.addEventListener('pagehide', pageHide);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', pageHide); };
  }, []);
  const expiry = available?.expiresAt ?? expiresAt;
  useEffect(() => {
    if (!expiry) return;
    const timer = setTimeout(() => void clear().then(success => {
      if (success) setMessage('Det sparade utkastet har löpt ut. Svar som är öppna här finns kvar tills du lämnar sidan.');
    }), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timer);
  }, [expiry]);
  async function clear() {
    generation.current++; active.current = false;
    erasedSnapshot.current = JSON.stringify(latest.current);
    setClearing(true); setAvailable(null); setExpiresAt(null); setSaving(false); saved.current = '';
    try {
      await store.current?.clear();
      setEnabled(true); setMessage(''); return true;
    } catch {
      setEnabled(false); setMessage('Utkastet kunde inte raderas. Rensa webbplatsens lagrade data i webbläsaren.'); return false;
    } finally { setClearing(false); }
  }
  function resume() {
    const result = available;
    if (!result) return null;
    setAvailable(null); saved.current = JSON.stringify(result.draft); erasedSnapshot.current = '';
    setExpiresAt(result.expiresAt); setEnabled(true);
    return result.draft;
  }
  const pendingChanges = active.current && fingerprint !== saved.current && fingerprint !== erasedSnapshot.current
    && (!!value.narrative || Object.keys(value.answers).length > 0 || hasConsultationDetails(value.consultation));
  return { ready, enabled, available, expiresAt, saving: saving || pendingChanges, message, clear, resume };
}
export type AnamnesDraftControls = ReturnType<typeof useAnamnesDraft>;
