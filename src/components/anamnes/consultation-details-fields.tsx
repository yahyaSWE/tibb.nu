"use client";

import type { ConsultationDetails } from "@/lib/anamnes/types";
import styles from "./tcm-anamnes.module.css";

type Props = {
  value: ConsultationDetails;
  disabled?: boolean;
  onChange: (patch: Partial<ConsultationDetails>) => void;
};

export function ConsultationDetailsFields({ value, disabled = false, onChange }: Props) {
  return <section className={styles.consultationFields} aria-labelledby="anamnes-complaint-details-title" aria-describedby="anamnes-complaint-details-help">
    <h3 id="anamnes-complaint-details-title">Om dina besvär</h3>
    <p id="anamnes-complaint-details-help" className={styles.smallNote}>Svara på det du känner till. Din berättelse och svaren här används tillsammans för att anpassa följdfrågorna när du väljer det anpassade frågeflödet. Du kan lämna ett fält tomt.</p>
    <div className={styles.detailFields}>
      <label htmlFor="anamnes-locations">Var sitter besvären?<input id="anamnes-locations" value={value.locations} disabled={disabled} maxLength={500} autoComplete="off" placeholder="Till exempel nacke, axlar och käke" onChange={event => onChange({ locations: event.target.value })} /></label>
      <div className={styles.detailFieldGrid}>
        <label htmlFor="anamnes-intensity">Hur starka är besvären? · 0–10<input id="anamnes-intensity" type="number" inputMode="numeric" min={0} max={10} step={1} value={value.intensity ?? ""} disabled={disabled} placeholder="0 = inga, 10 = värsta tänkbara" onChange={event => onChange({ intensity: event.target.value === "" ? null : Number(event.target.value) })} /></label>
        <label htmlFor="anamnes-frequency">Hur ofta märker du dem?<select id="anamnes-frequency" value={value.frequency} disabled={disabled} onChange={event => onChange({ frequency: event.target.value as ConsultationDetails["frequency"] })}>
          <option value="">Välj om du vill</option><option value="daily">Varje dag</option><option value="several_week">Flera gånger i veckan</option><option value="weekly">Ungefär varje vecka</option><option value="occasional">Mer sällan</option><option value="variable">Det varierar</option>
        </select></label>
      </div>
      <label htmlFor="anamnes-daily-impact">Hur påverkas din vardag?<textarea id="anamnes-daily-impact" value={value.dailyImpact} disabled={disabled} maxLength={1200} rows={3} autoComplete="off" placeholder="Till exempel sömn, arbete, rörelse eller sådant du undviker" onChange={event => onChange({ dailyImpact: event.target.value })} /></label>
      <label htmlFor="anamnes-goal">Vad hoppas du få hjälp med?<textarea id="anamnes-goal" value={value.goal} disabled={disabled} maxLength={1000} rows={2} autoComplete="off" placeholder="Vad vill du kunna göra eller må bättre i?" onChange={event => onChange({ goal: event.target.value })} /></label>
      <label htmlFor="anamnes-previous-care">Vad har du redan provat eller fått undersökt?<textarea id="anamnes-previous-care" value={value.previousCare} disabled={disabled} maxLength={1500} rows={3} autoComplete="off" placeholder="Tidigare bedömningar, behandlingar och vad som hjälpt eller inte hjälpt" onChange={event => onChange({ previousCare: event.target.value })} /></label>
      <label htmlFor="anamnes-lifestyle">Något mer om dina vanor?<textarea id="anamnes-lifestyle" value={value.lifestyle} disabled={disabled} maxLength={1500} rows={3} autoComplete="off" placeholder="Till exempel matvanor, återhämtning, rörelse och stress" onChange={event => onChange({ lifestyle: event.target.value })} /></label>
    </div>
  </section>;
}
