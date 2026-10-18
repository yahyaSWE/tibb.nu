import { patternById } from './patterns';
import { answerLabel, questionById, validateAnswers } from './questions';
import type { AnswerMap, Evidence, QuestionId, Report } from './types';

export interface ReportObservation {
  questionId: QuestionId;
  prompt: string;
  answer: string;
}

export interface ReportCriterion extends ReportObservation {
  status: 'different_answer' | 'unknown' | 'withheld' | 'not_asked';
}

export interface ReportDirection {
  status: 'preliminary' | 'uncertain' | 'safety_blocked';
  heading: string;
  body: string;
  hypothesis: { name: string; pinyin: string } | null;
  references: { name: string; partial: boolean }[];
  formulaMessage: string;
  evaluationNotice: string;
}

export interface AnamnesReportExplanation {
  direction: ReportDirection;
  overview: string[];
  observations: ReportObservation[];
  limitations: string[];
  nextSteps: string[];
  comparison: {
    supporting: string[];
    opposing: string[];
    unmetCriteria: ReportCriterion[];
  } | null;
  coverage: { answered: number; known: number; unknown: number; withheld: number };
}

const safetyIds = new Set<QuestionId>(['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags']);
const backgroundIds: readonly QuestionId[] = ['focus','duration','onset','trend','priorAssessment'];
const uncertainValues = new Set(['unknown','prefer_not']);
const focusObservationIds: Record<string, readonly QuestionId[]> = {
  pain: ['painLocation','painCharacter','painWarmth','painMovement','weatherPain','stiffness','jointWarmth','backWeakness'],
  digestion: ['appetite','stool','afterMealBloat','stressDigestion','abdominalPain','reflux','foodTrigger','nausea'],
  energy: ['energy','exertion','weakVoice','pallor','dizziness','appetite','stool','sleep'],
  sleep: ['sleep','sleepOnset','nightWaking','rumination','palpitations','nightSweats','energy','emotion'],
  stress: ['emotion','irritability','stressRelief','ribTension','stressDigestion','sleep','energy','painCharacter'],
  temperature: ['temperature','thirst','sweating','hotPalms','nightSweats','dryMouth','urination','edema'],
  immunity: ['frequentInfections','windSensitivity','weakVoice','cough','phlegm','sweating','energy','temperature'],
};

function known(answers: AnswerMap, id: QuestionId): boolean {
  return Object.hasOwn(answers,id) && !uncertainValues.has(answers[id]!);
}

function observation(answers: AnswerMap, id: QuestionId): ReportObservation {
  return { questionId:id,prompt:questionById.get(id)!.prompt,answer:answerLabel(id,answers[id]) };
}

function evidenceLabels(items: Evidence[], maximum: number): string[] {
  const labels = new Map<string,string>();
  for (const item of items) labels.set(`${item.questionId}:${item.answer}`,item.label);
  return [...labels.values()].slice(0,maximum);
}

function reportDirection(report: Report): ReportDirection {
  const evaluationNotice = 'Preliminärt TCM-underlag. En terapeut behöver bekräfta bedömningen och kontrollera säkerheten före eventuell användning av örter.';
  if (report.safety.blocksFormulas || report.safety.level !== 'clear') {
    return {
      status:'safety_blocked',
      heading:report.safety.level === 'emergency' ? 'Följ vårdhänvisningen' : 'Individuell bedömning behövs först',
      body:report.safety.level === 'emergency' ? report.safety.flags[0] ?? 'Avbryt formuläret och följ vårdhänvisningen.' : 'Säkerhetsuppgifterna behöver klarläggas eller bedömas individuellt. Följ vård- och säkerhetshänvisningarna i rapporten.',
      hypothesis:null,references:[],
      formulaMessage:'Inga formelreferenser visas innan säkerhetsfrågorna har klarlagts och eventuell individuell bedömning har gjorts.',
      evaluationNotice,
    };
  }
  const primary = report.analysis.primary;
  if (report.analysis.status !== 'preliminary' || !primary?.qualified) {
    return {
      status:'uncertain',heading:'Ingen tydlig mönsterhypotes ännu',
      body:report.analysis.status === 'conflicting'
        ? 'Svaren pekar åt olika håll. En behandlare behöver gå igenom skillnaderna innan ett huvudmönster kan föreslås.'
        : report.analysis.status === 'preliminary' && !primary
          ? 'Flera preliminära mönster ligger nära varandra. En behandlare behöver särskilja dem innan ett huvudmönster kan väljas.'
          : 'Underlaget ger ingen tillräckligt tydlig riktning. Systemet väljer därför varken en huvudförklaring eller en passande örtformel.',
      hypothesis:null,references:[],
      formulaMessage:report.analysis.status === 'preliminary' && !primary && report.formulaReferencesEnabled && report.formulaStatus === 'matched' && report.formulaMatches.length
        ? 'Ingen formelreferens kan prioriteras som huvudalternativ. Jämförelserna längre ned behöver särskiljas tillsammans med en behandlare.'
        : 'Ingen formelreferens kan väljas utifrån den samlade bedömningen.',
      evaluationNotice,
    };
  }
  // These are existing, independently checked report references. The helper
  // never derives a formula from a pattern name or fills an empty assortment.
  const references = report.formulaReferencesEnabled && report.formulaStatus === 'matched'
    ? report.formulaMatches.slice(0,3).map(formula => ({name:formula.name,partial:formula.partial}))
    : [];
  const formulaMessage = !report.formulaReferencesEnabled || report.formulaStatus === 'disabled'
    ? 'Formelreferenser är avstängda i detta underlag.'
    : references.length
      ? `Formelreferenserna är teoretiska jämförelser att diskutera med en behandlare.${references.some(formula => formula.partial) ? ' Delvis överensstämmelse innebär att formeln inte täcker hela symtombilden.' : ''}`
      : report.formulaStatus === 'no_match'
        ? 'Ingen av de aktiva formlerna i sortimentet passar tillräckligt väl till den samlade bedömningen.'
        : 'Underlaget räcker ännu inte till en formeljämförelse.';
  return {
    status:'preliminary',heading:`Svaren lutar inom TCM-modellen åt ${primary.name}`,
    body:'Detta är den tydligaste preliminära mönsterhypotesen i den samlade bedömningen. Se nedan vilka bekräftade svar som talar för och emot den.',
    hypothesis:{name:primary.name,pinyin:primary.pinyin},references,formulaMessage,evaluationNotice,
  };
}

/**
 * Explain the returned report, without creating a second diagnostic result.
 * Only explicit, validated answers are summarized; free text is never mined
 * for findings. Incomplete rule comparisons remain unnamed and unestablished.
 */
export function explainAnamnesReport(report: Report, input: AnswerMap): AnamnesReportExplanation {
  const answers = validateAnswers(input);
  const direction = reportDirection(report);
  const values = Object.values(answers);
  const coverage = {
    answered:values.length,
    known:values.filter(value => !uncertainValues.has(value)).length,
    unknown:values.filter(value => value === 'unknown').length,
    withheld:values.filter(value => value === 'prefer_not').length,
  };
  const overview: string[] = [];
  for (const [id,label] of [['focus','Område'],['duration','Besvärens varaktighet'],['trend','Förlopp'],['priorAssessment','Tidigare vårdbedömning']] as const) {
    if (Object.hasOwn(answers,id)) overview.push(`${label}: ${answerLabel(id,answers[id])}`);
  }

  if (report.safety.level === 'emergency') {
    return {direction,overview,observations:[],coverage,comparison:null,limitations:[...report.safety.flags],nextSteps:['Avbryt formuläret och följ vårdhänvisningen ovan.']};
  }

  const symptomIds = [...new Set([
    ...(focusObservationIds[answers.focus ?? ''] ?? []),
    ...questionById.keys(),
  ])].filter(id => !safetyIds.has(id) && !backgroundIds.includes(id) && !questionById.get(id)!.professionalOnly && known(answers,id));
  const observations = symptomIds.slice(0,8).map(id => observation(answers,id));
  const limitations: string[] = [];
  const nextSteps: string[] = [];

  if (report.analysis.status === 'insufficient') {
    limitations.push('Den samlade bedömningen ger ingen tillräckligt tydlig mönsterhypotes. Det betyder inte att dina besvär saknar en förklaring.');
    if (report.source === 'ai') limitations.push('Den samlade AI- och regelbedömningen är fortfarande osäker. Enskilda regelträffar visas därför inte som en slutsats.');
  } else if (report.analysis.status === 'conflicting') {
    limitations.push('Vissa svar pekar åt olika håll. Dessa skillnader behöver förtydligas innan en huvudförklaring kan väljas.');
  } else if (!report.analysis.primary) {
    limitations.push('Flera preliminära mönster ligger nära varandra. Underlaget räcker inte för att välja ett huvudmönster.');
  }

  const unclearBackground = backgroundIds.filter(id => Object.hasOwn(answers,id) && uncertainValues.has(answers[id]!));
  if (unclearBackground.length) limitations.push(`Osäkra eller utelämnade bakgrundssvar: ${unclearBackground.map(id => questionById.get(id)!.prompt).join(' ')}`);
  if (coverage.unknown || coverage.withheld) limitations.push('”Vet inte” och ”Vill inte svara” räknas inte som ett nej eller som ett bekräftat fynd. Du behöver inte gissa eller lämna ett svar du inte vill lämna.');

  // Even a rule-qualified finding must not reappear as a result when the final
  // report (for example an uncertain AI differential) deliberately withholds it.
  const candidates = report.analysis.status === 'insufficient' && !report.analysis.patterns.some(pattern => pattern.qualified)
    ? report.analysis.patterns.filter(pattern => pattern.supporting.length >= 2).slice(0,3)
    : [];
  const criteria = new Map<QuestionId,ReportCriterion>();
  for (const candidate of candidates) {
    const definition = patternById.get(candidate.id);
    if (!definition) continue;
    const unmetCore = definition.coreRules.filter(rule => !known(answers,rule.questionId) || !rule.values.includes(answers[rule.questionId]!));
    for (const id of [...unmetCore.map(rule => rule.questionId),...candidate.missingQuestionIds]) {
      if (criteria.has(id) || questionById.get(id)?.professionalOnly) continue;
      const answer = answers[id];
      criteria.set(id,{
        ...observation(answers,id),
        status:!Object.hasOwn(answers,id) ? 'not_asked' : answer === 'unknown' ? 'unknown' : answer === 'prefer_not' ? 'withheld' : 'different_answer',
      });
    }
  }
  const comparison = candidates.length ? {
    supporting:evidenceLabels(candidates.flatMap(pattern => pattern.supporting),6),
    opposing:evidenceLabels(candidates.flatMap(pattern => pattern.opposing),4),
    unmetCriteria:[...criteria.values()].slice(0,5),
  } : null;

  if (report.safety.level !== 'clear') {
    nextSteps.push('Följ vård- och säkerhetshänvisningarna i rapporten innan eventuell TCM-bedömning.');
  } else {
    nextSteps.push('Boka en konsultation för att gå igenom besvär, svar och eventuella skillnader i underlaget tillsammans med en behandlare.');
  }
  if (answers.priorAssessment === 'no' || answers.priorAssessment === 'unknown' || !Object.hasOwn(answers,'priorAssessment')) {
    nextSteps.push('Ta upp om besvären har bedömts i hälso- och sjukvården. Formuläret kan inte utesluta medicinska orsaker.');
  }
  if (report.followUpQuestionIds.length) nextSteps.push('Kompletterande frågor finns nedan. Svara bara på det du känner till; osäkra uppgifter kan tas upp vid konsultationen.');

  return {direction,overview,observations,limitations,nextSteps,comparison,coverage};
}
