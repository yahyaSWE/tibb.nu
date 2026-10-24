import { questionById } from './questions';
import { ConsultationDetailsSchema, type AnswerMap, type ConsultationDetails } from './types';

const safetyQuestionIds = new Set(['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags']);
const safetyFields = new Set(['medicationDetails','conditionDetails','allergyDetails']);
export const consultationFrequencyLabels: Record<ConsultationDetails['frequency'], string> = {
  '': '', daily: 'Dagligen', several_week: 'Flera gånger i veckan', weekly: 'Ungefär en gång i veckan', occasional: 'Enstaka tillfällen', variable: 'Varierar',
};
const fieldLabels = {
  locations: 'Var besvären sitter', intensity: 'Besvärens intensitet', frequency: 'Hur ofta besvären kommer', dailyImpact: 'Påverkan på vardagen', goal: 'Önskemål och mål',
  previousCare: 'Tidigare undersökning, behandling och resultat', lifestyle: 'Vardag, återhämtning och levnadsvanor', medicationDetails: 'Läkemedel och kosttillskott – komplettering',
  conditionDetails: 'Sjukdomar och tidigare vård – komplettering', allergyDetails: 'Allergier och reaktioner – komplettering',
} as const;
export function consultationDetailRows(input: ConsultationDetails): { key: string; label: string; value: string }[] {
  const details = ConsultationDetailsSchema.parse(input);
  const rows: { key: string; label: string; value: string }[] = Object.entries(fieldLabels).flatMap(([key, label]) => {
    const raw = details[key as keyof typeof fieldLabels];
    const value = key === 'intensity' ? raw === null ? '' : `${raw} av 10` : key === 'frequency' ? consultationFrequencyLabels[details.frequency] : String(raw);
    return value ? [{ key, label, value }] : [];
  });
  for (const [id, value] of Object.entries(details.questionNotes)) {
    const question = questionById.get(id as keyof ConsultationDetails['questionNotes']);
    if (value && question && !question.professionalOnly) rows.push({ key: `questionNotes.${id}`, label: question.prompt, value });
  }
  for(const item of details.confirmedObservations??[]){
    const question=questionById.get(item.questionId);
    if(question&&!safetyQuestionIds.has(item.questionId)&&!question.professionalOnly){
      const option=question.options.find(value=>value.value===item.answer);
      if(option)rows.push({key:`confirmedObservations.${item.questionId}`,label:`Bekräftad tolkning${item.corrected?' (korrigerad)':''}: ${question.prompt}`,value:`${option.label} · Egen text: ”${item.excerpt}”`});
    }
  }
  return rows;
}
export function hasConsultationDetails(input: ConsultationDetails): boolean { return consultationDetailRows(input).length > 0; }
export function normalizeConsultationDetails(input: ConsultationDetails | undefined, answers: AnswerMap): ConsultationDetails {
  const details = ConsultationDetailsSchema.parse(input ?? {});
  return { ...details, ...(details.confirmedObservations?{confirmedObservations:details.confirmedObservations.filter((item,index,all)=>!safetyQuestionIds.has(item.questionId)&&item.questionId!=='pulse'&&item.questionId!=='priorAssessment'&&answers[item.questionId]===item.answer&&questionById.get(item.questionId)?.options.some(option=>option.value===item.answer)&&all.findIndex(other=>other.questionId===item.questionId)===index)}:{}), medicationDetails: answers.medication === 'yes' ? details.medicationDetails : '', conditionDetails: answers.chronicDisease === 'yes' || answers.liverKidney === 'yes' ? details.conditionDetails : '', allergyDetails: answers.allergy === 'yes' ? details.allergyDetails : '' };
}
export function consultationForAi(input: ConsultationDetails) {
  const { medicationDetails: _medication, conditionDetails: _condition, allergyDetails: _allergy, confirmedObservations:_observations, questionNotes, ...complaint } = ConsultationDetailsSchema.parse(input);
  return { ...complaint, questionNotes: Object.fromEntries(Object.entries(questionNotes).filter(([id, text]) => !safetyQuestionIds.has(id) && !!text)) };
}
export function hasAiConsultationDetails(input: ConsultationDetails): boolean {
  const {questionNotes,...fields}=consultationForAi(input);
  return Object.values(fields).some(value => value!=='' && value!==null) || Object.keys(questionNotes).length>0;
}
export function consultationDetailsText(input: ConsultationDetails, { includeSafetyDetails = true }: { includeSafetyDetails?: boolean } = {}): string {
  return consultationDetailRows(input).filter(row => includeSafetyDetails || !safetyFields.has(row.key) && !(row.key.startsWith('questionNotes.') && safetyQuestionIds.has(row.key.slice(14)))).map(row => `${row.label}: ${row.value}`).join('\n');
}
/** Screen each bounded own-text field separately; it is never a scored finding. */
export function consultationSafetyTexts(input: ConsultationDetails): string[] {
  const details = ConsultationDetailsSchema.parse(input);
  return [details.locations, details.dailyImpact, details.goal, details.previousCare, details.lifestyle, details.medicationDetails, details.conditionDetails, details.allergyDetails, ...Object.values(details.questionNotes)].filter((value): value is string => !!value);
}
