"use client";

import { safetyQuestionIds } from "@/lib/anamnes/engine";
import { questionById } from "@/lib/anamnes/questions";
import { emptyConsultationDetails, type AnswerMap, type ConsultationDetails, type Question } from "@/lib/anamnes/types";
import styles from "./tcm-anamnes.module.css";

export interface SafetyQuestionsProps {
  answers: AnswerMap;
  medicationNames: string;
  busy: boolean;
  onAnswer: (question: Question, value: string) => void;
  onMedicationNamesChange: (value: string) => void;
  consultation?: ConsultationDetails;
  onConsultationChange?: (patch: Partial<ConsultationDetails>) => void;
}

const orderedSafetyIds = [
  ...safetyQuestionIds.filter(id => id === "emergency" || id === "clinicalRedFlags"),
  ...safetyQuestionIds.filter(id => id !== "emergency" && id !== "clinicalRedFlags"),
];

export function SafetyQuestions({ answers, medicationNames, busy, onAnswer, onMedicationNamesChange, consultation = emptyConsultationDetails(), onConsultationChange }: SafetyQuestionsProps) {
  return <div className={styles.safetyQuestions}>
    {orderedSafetyIds.map(id => {
      const question = questionById.get(id)!;
      const helpId = `safety-${id}-help`;
      return <fieldset key={id} id={`safety-${id}`} tabIndex={-1} className={styles.safetyQuestion} disabled={busy} aria-describedby={question.help ? helpId : undefined}>
        <legend>{question.prompt}</legend>
        {question.help && <p id={helpId} className={styles.smallNote}>{question.help}</p>}
        <div className={styles.safetyOptions}>
          {question.options.map(option => <label key={option.value} className={`${styles.option} ${answers[id] === option.value ? styles.selected : ""}`}>
            <input type="radio" name={`anamnes-${id}`} value={option.value} checked={answers[id] === option.value} required disabled={busy} onChange={() => onAnswer(question, option.value)} />
            <span>{option.label}</span>
          </label>)}
        </div>
        {id === "medication" && answers.medication === "yes" && <div className={styles.medicationDetails}>
          <label htmlFor="anamnes-medication-names">Vilka läkemedel eller kosttillskott tar du?</label>
          <p id="anamnes-medication-names-help" className={styles.smallNote}>Ange namnen, ett per rad. Uppgifterna är till för behandlaren och skickas inte till AI.</p>
          <textarea id="anamnes-medication-names" name="medicationNames" value={medicationNames} required maxLength={1000} autoComplete="off" rows={3} placeholder="Namn på läkemedel eller kosttillskott" disabled={busy} aria-describedby="anamnes-medication-names-help" onChange={event => onMedicationNamesChange(event.target.value)} />
          <label htmlFor="anamnes-medication-details">Dos, hur ofta och varför · valfritt</label>
          <textarea id="anamnes-medication-details" value={consultation.medicationDetails} maxLength={1500} autoComplete="off" rows={3} placeholder="Skriv det du känner till om det du tar" disabled={busy} onChange={event => onConsultationChange?.({ medicationDetails: event.target.value })} />
        </div>}
        {(id === "chronicDisease" && answers.chronicDisease === "yes" || id === "liverKidney" && answers.liverKidney === "yes" && answers.chronicDisease !== "yes") && <div className={styles.medicationDetails}>
          <label htmlFor="anamnes-condition-details">Vilka sjukdomar eller tidigare diagnoser gäller det? · valfritt</label>
          <p className={styles.smallNote}>Beskriv det du vill att behandlaren ska känna till. Uppgifterna skickas inte till AI.</p>
          <textarea id="anamnes-condition-details" value={consultation.conditionDetails} maxLength={1500} autoComplete="off" rows={3} placeholder="Till exempel diagnos, uppföljning och sådant du fått råd att undvika" disabled={busy} onChange={event => onConsultationChange?.({ conditionDetails: event.target.value })} />
        </div>}
        {id === "allergy" && answers.allergy === "yes" && <div className={styles.medicationDetails}>
          <label htmlFor="anamnes-allergy-details">Vad reagerar du på och hur? · valfritt</label>
          <p className={styles.smallNote}>Ange kända ämnen och tidigare reaktioner. Uppgifterna skickas inte till AI.</p>
          <textarea id="anamnes-allergy-details" value={consultation.allergyDetails} maxLength={1500} autoComplete="off" rows={3} placeholder="Ämne eller produkt och hur reaktionen visade sig" disabled={busy} onChange={event => onConsultationChange?.({ allergyDetails: event.target.value })} />
        </div>}
      </fieldset>;
    })}
  </div>;
}
