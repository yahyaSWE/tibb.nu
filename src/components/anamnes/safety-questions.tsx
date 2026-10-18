"use client";

import { safetyQuestionIds } from "@/lib/anamnes/engine";
import { questionById } from "@/lib/anamnes/questions";
import type { AnswerMap, Question } from "@/lib/anamnes/types";
import styles from "./tcm-anamnes.module.css";

export interface SafetyQuestionsProps {
  answers: AnswerMap;
  medicationNames: string;
  busy: boolean;
  onAnswer: (question: Question, value: string) => void;
  onMedicationNamesChange: (value: string) => void;
}

const orderedSafetyIds = [
  ...safetyQuestionIds.filter(id => id === "emergency" || id === "clinicalRedFlags"),
  ...safetyQuestionIds.filter(id => id !== "emergency" && id !== "clinicalRedFlags"),
];

export function SafetyQuestions({ answers, medicationNames, busy, onAnswer, onMedicationNamesChange }: SafetyQuestionsProps) {
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
          <p id="anamnes-medication-names-help" className={styles.smallNote}>Ange namnen, ett per rad. Dosering behövs inte.</p>
          <textarea id="anamnes-medication-names" name="medicationNames" value={medicationNames} required maxLength={1000} autoComplete="off" rows={3} placeholder="Namn på läkemedel eller kosttillskott" disabled={busy} aria-describedby="anamnes-medication-names-help" onChange={event => onMedicationNamesChange(event.target.value)} />
        </div>}
      </fieldset>;
    })}
  </div>;
}
