import { answerLabel, getFollowupQuestions, questionById, validateAnswers, validateFormulaRules } from './questions';
import { patternById, patternCatalog, rule } from './patterns';
import { FormulaRecordSchema, NarrativeSchema, type AnswerMap, type ConsultationDetails, type Evidence, type EvidenceRule, type FormulaMatch, type FormulaRecord, type PatternAnalysis, type PatternFinding, type PatternId, type QuestionId, type Report, type SafetyAssessment } from './types';
import { consultationSafetyTexts, normalizeConsultationDetails } from './consultation';
import { supplierVerificationPending } from './formula-verification';

const unknown = new Set(['unknown','prefer_not']);
const answered = (answers: AnswerMap, id: QuestionId) => Boolean(answers[id] && !unknown.has(answers[id]!));
const matches = (answers: AnswerMap, item: EvidenceRule) => answered(answers,item.questionId) && item.values.includes(answers[item.questionId]!);
const dedupe = <T,>(values: T[]) => [...new Set(values)];
function observations(answers: AnswerMap, rules: readonly EvidenceRule[]): Evidence[] {
  return rules.filter(item => matches(answers,item)).map(item => ({
    questionId: item.questionId, answer: answers[item.questionId]!,
    label: `${questionById.get(item.questionId)!.prompt} — ${answerLabel(item.questionId,answers[item.questionId])}`, weight: item.weight,
  }));
}
function uniqueEvidence(values: Evidence[]): Evidence[] {
  // First occurrence wins. Formula-specific evidence is deliberately passed
  // before shared pattern evidence, so catalog weights remain authoritative
  // instead of being silently replaced by a generic pattern's weight.
  const evidence = new Map<string,Evidence>();
  for (const item of values) {
    const key = `${item.questionId}:${item.answer}`;
    if (!evidence.has(key)) evidence.set(key,item);
  }
  return [...evidence.values()];
}
const sum = (evidence: Evidence[]) => evidence.reduce((total,item) => total + item.weight,0);
export const safetyQuestionIds: readonly QuestionId[] = ['adult','pregnancy','medication','chronicDisease','liverKidney','allergy','emergency','clinicalRedFlags'];
/** Only a complete, unqualified medication-denial sentence is ignored here. */
function withoutClearMedicationDenial(text: string): string {
  // Exceptions, uncertainty, past use and conditional wording need review.
  if (/\b(?:men|förutom|utom|undantag|ibland|vid behov|endast|bara|dock|ändå|tidigare|slutat|pausat|längre|tror|kanske)\b/u.test(text)) return text;
  return text.replace(/(^|[.!?\n]\s*)jag (?:tar|använder) inga (?:mediciner|läkemedel)(?=[.!?\n]|$)/gu, '$1');
}
/** A mention gate, never symptom extraction. Acute mentions remain conservative. */
export function getNarrativeSafety(input: string): SafetyAssessment | null {
  const text = NarrativeSchema.parse(input).normalize('NFKC').toLocaleLowerCase('sv-SE');
  if (/(?:\bbröstsmärta\b|\bsmärta i bröst(?:et)?\b|\bakut brösttryck\b|\bsvår(?:a)? (?:andnöd|andningssvårigheter)\b|\bkan inte andas\b|\bplötslig(?:a)? (?:förlamning|ansiktsförlamning|talsvårigheter)\b|\bstroke\b|\banafylaxi\b|\bchest pain\b|\bsevere (?:breathlessness|shortness of breath)\b|\bcan(?:not|'t) breathe\b)/u.test(text)) {
    return { level:'emergency',blocksFormulas:true,missingQuestionIds:[],flags:['Din fritext nämner möjliga akuta varningssymtom. Systemet kan inte avgöra om detta gäller dig just nu, gäller tidigare besvär eller är nekat i texten. Avbryt formuläret. Vid pågående bröstsmärta, svår andnöd, plötsliga neurologiska symtom eller annat akut tillstånd: ring 112. Vid osäkerhet, kontakta 1177 för bedömning.'] };
  }
  if (/(?:\bblod i (?:avföring(?:en)?|kräkning(?:ar)?)\b|\bkräk(?:s|er|t|te)? blod\b|\boförklarlig(?:a)? viktnedgång\b|\bofrivillig viktnedgång\b|\b(?:ihållande|långvarig|hög) feber\b|\bnytillkommen svår smärta\b|\bblood in (?:stool|vomit)\b|\bunexplained weight loss\b|\bpersistent fever\b)/u.test(text)) {
    return {level:'medical_review',blocksFormulas:true,missingQuestionIds:[],flags:['Din fritext nämner uppgifter som kan vara varningssymtom. Det är inte en bekräftad medicinsk observation; systemet kan inte tolka sammanhang eller negation säkert. Kontakta hälso- och sjukvården för bedömning innan eventuell TCM-rådgivning eller användning av örter.']};
  }
  if (/(?:\bgravid(?:itet|itetsplanering)?\b|\bam(?:mar|mande|ning)\b|\bpregnan(?:t|cy)\b|\bbreastfeeding\b|\bläkemedel\b|\bmedicin(?:er|ering)?\b|\bblodförtunnande\b|\bwarfarin\b|\bwaran\b|\beliquis\b|\bxarelto\b|\binsulin\b|\bmetformin\b|\bkortison\b|\bantidepressiva\b|\bmedication\b|\b(?:lever|njur)(?:sjukdom|svikt)\b)/u.test(withoutClearMedicationDenial(text))) {
    return {level:'consultation',blocksFormulas:true,missingQuestionIds:[],flags:['Din fritext nämner graviditet, amning, läkemedel eller ett annat möjligt säkerhetsförhållande. Systemet kan inte fastställa om uppgiften är aktuell eller nekad. En behandlare behöver klargöra detta och kontrollera säkerhet och eventuella interaktioner innan formelreferenser kan övervägas.']};
  }
  return null;
}
export function getSafetyAssessment(input: AnswerMap, narrative = '', consultation?: ConsultationDetails): SafetyAssessment {
  const answers = validateAnswers(input);
  const details = normalizeConsultationDetails(consultation, answers);
  const textFindings = [narrative, ...consultationSafetyTexts(details)].map(getNarrativeSafety);
  const narrativeSafety = textFindings.find(finding => finding?.level === 'emergency') ?? textFindings.find(finding => finding?.level === 'medical_review') ?? textFindings.find(finding => finding?.level === 'consultation');
  const missingQuestionIds = safetyQuestionIds.filter(id => !answered(answers,id));
  // A visitor who has already been asked about a potentially inflamed joint
  // must not have an unknown/withheld response interpreted as a reassuring no.
  // An unasked question remains available to the adaptive interview.
  if (answers.focus === 'pain' && Object.hasOwn(answers,'jointWarmth') && !answered(answers,'jointWarmth')) missingQuestionIds.push('jointWarmth');
  if (answers.emergency === 'yes' || narrativeSafety?.level === 'emergency') return { level: 'emergency', blocksFormulas: true, flags: [...(answers.emergency === 'yes' ? ['Avbryt anamnesen. Vid akut eller livshotande tillstånd: ring 112.'] : []),...(narrativeSafety?.flags ?? [])], missingQuestionIds: [...missingQuestionIds] };
  const medicalFlags = [
    answers.clinicalRedFlags === 'yes' && 'Varningssymtom behöver bedömas i hälso- och sjukvården innan TCM-bedömning.',
    answers.urination === 'burning' && 'Sveda eller täta trängningar vid urinering behöver medicinsk bedömning.',
    answers.jointWarmth === 'yes' && 'En röd, varm eller svullen led behöver medicinsk bedömning.',
    answers.chestTightness === 'yes' && 'Brösttryck behöver medicinsk bedömning. Vid pågående akut bröstsmärta eller svår andnöd: ring 112.',
    answers.breathing === 'yes' && 'Oförklarlig andfåddhet behöver medicinsk bedömning.',
    answers.palpitations === 'yes' && 'Hjärtklappning behöver medicinsk bedömning.',
    answers.trend === 'worsening' && 'Tilltagande besvär behöver följas upp i vården.',
  ].filter((value): value is string => Boolean(value));
  if (narrativeSafety?.level === 'medical_review') medicalFlags.push(...narrativeSafety.flags);
  if (medicalFlags.length) return { level: 'medical_review',blocksFormulas: true, flags: medicalFlags,missingQuestionIds: [...missingQuestionIds] };
  const consultationFlags = [
    answers.adult === 'no' && 'Barn och minderåriga behöver individuell bedömning; inga formelreferenser visas.',
    answers.pregnancy === 'yes' && 'Graviditet, amning eller graviditetsplanering kräver individuell säkerhetsbedömning.',
    answers.medication === 'yes' && 'Läkemedel och kosttillskott kräver kontroll av möjliga interaktioner.',
    answers.chronicDisease === 'yes' && 'Pågående eller långvarig sjukdom kräver individuell säkerhetsbedömning.',
    answers.liverKidney === 'yes' && 'Lever- eller njurproblem kräver medicinsk och produktspecifik säkerhetsbedömning.',
    answers.allergy === 'yes' && 'Allergi eller tidigare kraftig reaktion kräver kontroll av det faktiska produktinnehållet.',
    details.medicationDetails && 'Kompletteringen om läkemedel eller kosttillskott behöver klargöras individuellt.',
    details.conditionDetails && 'Kompletteringen om sjukdomar eller tidigare vård behöver klargöras individuellt.',
    details.allergyDetails && 'Kompletteringen om allergier eller reaktioner behöver klargöras individuellt.',
  ].filter((value): value is string => Boolean(value));
  if (narrativeSafety?.level === 'consultation') consultationFlags.push(...narrativeSafety.flags);
  if (consultationFlags.length) return { level: 'consultation',blocksFormulas:true,flags:consultationFlags,missingQuestionIds: [...missingQuestionIds] };
  if (missingQuestionIds.length) return { level: 'incomplete',blocksFormulas:true,flags:['Säkerhetsfrågor saknar ett tydligt svar. Ingen säker formeljämförelse kan göras.'],missingQuestionIds: [...missingQuestionIds] };
  return { level: 'clear',blocksFormulas:false,flags:['Inga av formulärets säkerhetsspärrar har utlösts. Detta är ingen garanti för att en örtprodukt är säker för dig.'],missingQuestionIds:[] };
}

function dimension(answers: AnswerMap, left: string, right: string, leftRules: EvidenceRule[], rightRules: EvidenceRule[]) {
  const supporting = observations(answers,leftRules);
  const opposing = observations(answers,rightRules);
  const leftPoints = sum(supporting), rightPoints = sum(opposing);
  const value = leftPoints >= 4 && rightPoints >= 4 ? 'Blandade eller motsägelsefulla fynd' : leftPoints >= 4 && leftPoints - rightPoints >= 3 ? left : rightPoints >= 4 && rightPoints - leftPoints >= 3 ? right : 'Otillräckligt underlag';
  return {value,supporting,opposing};
}
function summarizeYinYang(coldHeat: PatternAnalysis['baGang']['coldHeat'], deficiencyExcess: PatternAnalysis['baGang']['deficiencyExcess']): PatternAnalysis['baGang']['yinYang'] {
  const supporting = uniqueEvidence([...coldHeat.supporting,...deficiencyExcess.supporting]);
  const opposing = uniqueEvidence([...coldHeat.opposing,...deficiencyExcess.opposing]);
  const cold = coldHeat.value === 'Kylprägel',heat = coldHeat.value === 'Värmeprägel';
  const deficiency = deficiencyExcess.value === 'Bristprägel',excess = deficiencyExcess.value === 'Överskottsprägel';
  let value = 'Otillräckligt underlag för en samlad Yin/Yang-bedömning';
  if ([coldHeat.value,deficiencyExcess.value].some(item => item === 'Blandade eller motsägelsefulla fynd')) {
    value = 'Blandade eller motstridiga Yin/Yang-aspekter; individuell differentiering behövs';
  } else if (cold && deficiency && supporting.length >= 3) {
    value = 'Preliminär Yin-prägel i Ba Gang: kyla och brist. Detta fastställer inte en individuell Yin- eller Yang-brist';
  } else if (heat && excess && opposing.length >= 3) {
    value = 'Preliminär Yang-prägel i Ba Gang: värme och överskott. Detta fastställer inte en individuell Yin- eller Yang-brist';
  } else if ((cold && excess) || (heat && deficiency)) {
    value = 'Blandade Yin/Yang-aspekter: kyla med överskott eller värme med brist behöver särskiljas individuellt';
  }
  return {value,supporting,opposing};
}
export function analyzePatterns(input: AnswerMap): PatternAnalysis {
  const answers = validateAnswers(input);
  const coldRules = [rule('temperature','cold',4),rule('painWarmth','better',2),rule('thirst','low',1)];
  const heatRules = [rule('temperature','hot',4),rule('thirst','strong_cold',3),rule('hotPalms','yes',2),rule('tongueColor','red',1),rule('heatTiming','persistent_strong',3),rule('tongueCoating','yellow_dry',2)];
  const deficiencyRules = [rule('energy','low',3),rule('weakVoice','yes',3),rule('pallor','yes',2),rule('exertion','tired',2)];
  const excessRules = [rule('painCharacter',['distending','stabbing'],3),rule('foodTrigger','yes',3),rule('tongueCoating',['white_greasy','yellow_greasy','yellow_dry'],2),rule('heatTiming','persistent_strong',3)];
  const interiorRules = [rule('duration',['months','years'],3),rule('stressDigestion','yes',2),rule('stool',['loose','dry','sticky','alternating'],1)];
  const exteriorRules = [rule('duration','days',3),rule('onset',['sudden','after_illness'],2),rule('cough',['dry','productive'],1)];
  const baGang: PatternAnalysis['baGang'] = {
    yinYang: { value: 'Otillräckligt underlag',supporting:[],opposing:[] },
    interiorExterior: dimension(answers,'Inre prägel','Möjlig yttre prägel',interiorRules,exteriorRules),
    coldHeat: dimension(answers,'Kylprägel','Värmeprägel',coldRules,heatRules),
    deficiencyExcess: dimension(answers,'Bristprägel','Överskottsprägel',deficiencyRules,excessRules),
  };
  baGang.yinYang = summarizeYinYang(baGang.coldHeat,baGang.deficiencyExcess);
  const conflicts: string[] = [];
  if (answers.temperature === 'mixed' || (sum(observations(answers,coldRules)) >= 4 && sum(observations(answers,heatRules)) >= 4)) conflicts.push('Både kyl- och värmetecken behöver särskiljas vid individuell bedömning.');
  if (answers.tongueColor === 'pale' && answers.temperature === 'hot' && answers.thirst === 'strong_cold') conflicts.push('Tungans färgobservation och tydliga värmefynd pekar åt olika håll.');
  const hasPainCharacter = answered(answers,'painCharacter') && answers.painCharacter !== 'none';
  const hasAbdominalPain = answered(answers,'abdominalPain') && answers.abdominalPain !== 'none';
  if (answers.pain === 'no' && (hasPainCharacter || hasAbdominalPain)) conflicts.push('Du har angett att du inte har återkommande värk eller stelhet men samtidigt beskrivit en smärtkaraktär eller buksmärta. Förtydliga vilka besvär och tidsperioder svaren gäller.');
  if (answers.painLocation === 'none' && hasPainCharacter) conflicts.push('Du har angett ingen värk när du beskriver platsen men samtidigt valt en smärtkaraktär. Dessa uppgifter behöver förtydligas.');
  const significantAnswerCount = Object.keys(answers).filter(id => !safetyQuestionIds.includes(id as QuestionId) && !['focus','duration','onset','trend','priorAssessment'].includes(id) && answered(answers,id as QuestionId)).length;
  const patterns: PatternFinding[] = patternCatalog.map(pattern => {
    const supporting = observations(answers,pattern.supportingRules);
    const opposing = observations(answers,pattern.opposingRules);
    const score = Math.max(0,sum(supporting) - sum(opposing));
    return {
      id:pattern.id,name:pattern.name,pinyin:pattern.pinyin,hanzi:pattern.hanzi,explanation:pattern.explanation,score,supporting,opposing,
      missingQuestionIds: dedupe([...pattern.requiredQuestionIds, ...(pattern.requiredEvidenceGroups ?? []).filter(group => !group.some(item => matches(answers,item))).flatMap(group => group.map(item => item.questionId))]).filter(id => !answered(answers,id)),
      qualified: significantAnswerCount >= 6 && supporting.length >= 3 && score >= 7 && sum(opposing) < 5 && pattern.coreRules.every(item => matches(answers,item)) && (pattern.requiredEvidenceGroups ?? []).every(group => group.some(item => matches(answers,item))),
    };
  }).filter(pattern => pattern.supporting.length > 0).sort((a,b) => b.score-a.score || b.supporting.length-a.supporting.length || a.id.localeCompare(b.id));
  const qualified = patterns.filter(pattern => pattern.qualified);
  const stopped = answers.emergency === 'yes';
  const status: PatternAnalysis['status'] = stopped ? 'insufficient' : conflicts.length ? 'conflicting' : !qualified.length ? 'insufficient' : 'preliminary';
  // A close or conflicting differential remains open: no forced main pattern.
  const primary = status === 'preliminary' && qualified[0] && (!qualified[1] || qualified[0].score-qualified[1].score >= 2) ? qualified[0] : null;
  const secondary = status === 'insufficient' ? [] : qualified.filter(pattern => pattern.id !== primary?.id).slice(0,2);
  return {
    status,primary,secondary,patterns: stopped ? [] : patterns,baGang,
    zangFu: stopped ? [] : dedupe(qualified.slice(0,3).flatMap(pattern => patternById.get(pattern.id)!.zangFu)),
    missingQuestionIds: dedupe(patterns.slice(0,3).flatMap(pattern => pattern.missingQuestionIds)).slice(0,15), conflicts,
  };
}
export const analyzeAnswers = analyzePatterns;

export function productVerificationComplete(formula: FormulaRecord): boolean {
  return !supplierVerificationPending(formula) && formula.productId !== null && formula.productIdentityVerified && formula.ingredientsVerified && formula.safetyVerified && formula.regulatoryVerified && formula.ingredients.length > 0 && formula.ingredients.every(value => value.trim().length > 0) && [formula.identityEvidence,formula.ingredientEvidence,formula.safetyEvidence,formula.regulatoryEvidence].every(value => value.trim().length >= 20);
}

/** Only independently supported candidates are checked against the assortment. */
function independentFormulaCandidates(analysis: PatternAnalysis, catalog: readonly FormulaRecord[]) {
  if (analysis.status !== 'preliminary') return [];
  const qualifiedIds = new Set(analysis.patterns.filter(pattern => pattern.qualified).map(pattern => pattern.id));
  const active = catalog.map(formula => FormulaRecordSchema.parse(formula)).filter(formula => formula.active && validateFormulaRules(formula));
  const dominant = analysis.primary ?? analysis.patterns.find(pattern => pattern.qualified);
  if (dominant && !active.some(formula => formula.primaryPatternIds.includes(dominant.id))) return [];
  return active.filter(formula => formula.primaryPatternIds.some(id => qualifiedIds.has(id)) && formula.requiredPatternIds.every(id => qualifiedIds.has(id)));
}

function formulaSafetyReasons(formula: FormulaRecord, answers: AnswerMap): string[] {
  return dedupe([
    ...formula.contraindicationRules.filter(item => matches(answers,item)).map(item => `Referensen utesluts av följande svar: ${questionById.get(item.questionId)!.prompt} — ${answerLabel(item.questionId,answers[item.questionId])}`),
    ...formula.requiredSafetyRules.filter(item => !matches(answers,item)).map(item => answered(answers,item.questionId)
      ? `Ett obligatoriskt säkerhetsvillkor är inte uppfyllt: ${questionById.get(item.questionId)!.prompt} — ${answerLabel(item.questionId,answers[item.questionId])}`
      : `Ett obligatoriskt säkerhetssvar saknas eller är osäkert: ${questionById.get(item.questionId)!.prompt}`),
  ]).slice(0,40);
}

export function matchFormulas(analysis: PatternAnalysis, input: AnswerMap, catalog: readonly FormulaRecord[], narrative = '', consultation?: ConsultationDetails): FormulaMatch[] {
  const answers = validateAnswers(input);
  if (getSafetyAssessment(answers,narrative,consultation).blocksFormulas || analysis.status !== 'preliminary') return [];
  return independentFormulaCandidates(analysis,catalog).flatMap((formula): FormulaMatch[] => {
    // Negative or absent mandatory safety evidence always overrides scoring.
    if (formulaSafetyReasons(formula,answers).length) return [];
    const mainPatterns = formula.primaryPatternIds.filter(id => analysis.patterns.some(pattern => pattern.id === id && pattern.qualified));
    const supporting = uniqueEvidence([...observations(answers,formula.supportingRules), ...analysis.patterns.filter(pattern => mainPatterns.includes(pattern.id)).flatMap(pattern => pattern.supporting)]);
    const opposing = uniqueEvidence([...observations(answers,formula.opposingRules), ...analysis.patterns.filter(pattern => mainPatterns.includes(pattern.id)).flatMap(pattern => pattern.opposing)]);
    const ruleSupport = observations(answers,formula.supportingRules);
    if (supporting.length < 3 || (formula.supportingRules.length > 0 && (ruleSupport.length < 2 || sum(ruleSupport) < 6)) || sum(opposing) >= 5) return [];
    // Legacy catalogs may still reference a retired background question. It
    // must not become an impossible-to-answer missing symptom criterion.
    const missingQuestionIds = dedupe([...formula.requiredQuestionIds.filter(id => !questionById.get(id)?.retired && !answered(answers,id)), ...analysis.patterns.filter(pattern => mainPatterns.includes(pattern.id)).flatMap(pattern => pattern.missingQuestionIds)]);
    const uncovered = analysis.patterns.filter(pattern => pattern.qualified && ![...formula.primaryPatternIds,...formula.secondaryPatternIds].includes(pattern.id));
    const partial = missingQuestionIds.length > 0 || opposing.length > 0 || uncovered.length > 0;
    const productUrl = productVerificationComplete(formula) && formula.productUrl && /^\/butik\/[a-z0-9-]+$/.test(formula.productUrl) ? formula.productUrl : null;
    const productAvailable = productVerificationComplete(formula) && productUrl !== null;
    return [{
      formulaId:formula.id,name:formula.name,pinyin:formula.pinyin,hanzi:formula.hanzi,swedishName:formula.swedishName,classicalName:formula.supplierProfile?.formulaName ?? formula.pinyin,
      requiresVerification:supplierVerificationPending(formula),verificationNotes:supplierVerificationPending(formula) ? ['Produktens ingrediensuppgifter behöver verifieras. Referensen kan endast diskuteras vid en individuell bedömning.'] : [],
      score: sum(supporting)-sum(opposing),explanation:formula.theoryExplanation,supporting,opposing,missingQuestionIds,partial,
      limitation: partial ? `Formeln förklarar inte säkert hela symtombilden. ${formula.scopeLimitation}`.trim() : `En teoretisk referens för konsultation. ${formula.scopeLimitation}`.trim(),
      safetyNotes:dedupe([...formula.safetyNotes,...formula.contraindications,...formula.interactions,'Det faktiska innehållet, medicinska risker och lämpligheten måste bedömas individuellt före eventuell användning.']),
      productAvailable,productId:productAvailable ? formula.productId : null,productUrl,
    }];
  }).sort((a,b) => b.score-a.score || a.formulaId.localeCompare(b.formulaId)).slice(0,3);
}
export function buildReport(input: AnswerMap, catalog: readonly FormulaRecord[], options: { source?: 'rules'|'ai'; followUpQuestionIds?: readonly QuestionId[]; formulaReferencesEnabled?: boolean; acceptedPatternIds?: readonly PatternId[]; narrative?: string; consultation?: ConsultationDetails } = {}): Report {
  const answers = validateAnswers(input);
  const safety = getSafetyAssessment(answers,options.narrative ?? '',options.consultation);
  const analysis = analyzePatterns(answers);
  if (safety.level === 'emergency') {
    analysis.status = 'insufficient';
    analysis.primary = null;
    analysis.secondary = [];
    analysis.patterns = [];
    analysis.zangFu = [];
    analysis.missingQuestionIds = [];
  }
  // An explicitly empty, valid AI differential expresses uncertainty, rather
  // than permission to fall back to a forced rule-based main hypothesis.
  // Keep the independent rule findings intact for the therapist's audit view.
  if (options.source === 'ai' && Array.isArray(options.acceptedPatternIds) && options.acceptedPatternIds.length === 0 && safety.level !== 'emergency') {
    analysis.status = 'insufficient';
    analysis.primary = null;
    analysis.secondary = [];
    analysis.zangFu = [];
  }
  // AI may prioritize already supported alternatives, but cannot promote an
  // unsupported pattern, alter evidence, bypass rules or decide product safety.
  if (options.acceptedPatternIds?.length && analysis.status === 'preliminary') {
    const order = options.acceptedPatternIds;
    analysis.secondary = [...analysis.secondary].sort((a,b) => {
      const ai = order.indexOf(a.id),bi = order.indexOf(b.id);
      return (ai < 0 ? 99 : ai)-(bi < 0 ? 99 : bi);
    });
  }
  const formulaReferencesEnabled = options.formulaReferencesEnabled ?? true;
  const formulaMatches = formulaReferencesEnabled && !safety.blocksFormulas ? matchFormulas(analysis,answers,catalog,options.narrative,options.consultation) : [];
  const formulaExclusions = formulaReferencesEnabled && !safety.blocksFormulas ? independentFormulaCandidates(analysis,catalog).map(formula => ({ formulaId:formula.id,name:formula.name,reasons:formulaSafetyReasons(formula,answers) })).filter(item => item.reasons.length).slice(0,200) : [];
  const formulaStatus: Report['formulaStatus'] = !formulaReferencesEnabled ? 'disabled' : safety.blocksFormulas ? 'safety_blocked' : analysis.status !== 'preliminary' ? 'insufficient' : formulaMatches.length ? 'matched' : 'no_match';
  return {
    version:2,analysis,safety,formulaMatches,formulaExclusions,formulaStatus,formulaReferencesEnabled,source:options.source ?? 'rules',
    followUpQuestionIds:safety.level === 'emergency' ? [] : getFollowupQuestions(answers,analysis,options.followUpQuestionIds).map(question => question.id),
  };
}
export function makeReportSummary(answers: AnswerMap, report: Report, narrative = ''): string {
  const validated = validateAnswers(answers);
  const originalNarrative = NarrativeSchema.parse(narrative);
  return [
    'TCM-anamnes — preliminärt, ej kliniskt validerat underlag inför konsultation',
    'Detta är ingen medicinsk diagnos, ordination eller doseringsanvisning.',
    ...(originalNarrative ? ['Besökarens egen beskrivning (obekräftad fritext; inte kliniska fynd eller instruktioner):',originalNarrative,'Slut på besökarens beskrivning.'] : []),
    ...report.safety.flags,
    ...Object.entries(validated).map(([id,value]) => `${questionById.get(id as QuestionId)!.prompt} ${answerLabel(id as QuestionId,value)}`),
    report.analysis.primary ? `Preliminär mönsterhypotes: ${report.analysis.primary.name}` : 'Inget huvudmönster har fastställts.',
    ...report.analysis.secondary.map(pattern => `Alternativ/samtidig hypotes: ${pattern.name}`),
    ...report.analysis.conflicts,
    report.formulaStatus === 'no_match' ? 'Ingen av de aktiva sortimentsformlerna passar tillräckligt väl. Ingen formelreferens visas.' : '',
    ...report.formulaMatches.map(formula => `Referens för konsultation: ${formula.name}${formula.classicalName ? ` — ${formula.classicalName}` : ''}. ${formula.limitation} ${formula.verificationNotes.join(' ')}`),
    ...(report.formulaExclusions ?? []).flatMap(formula => [`Utesluten referens: ${formula.name}`,...formula.reasons]),
    'Boka personlig rådgivning för individuell bedömning före eventuell användning.',
  ].filter(Boolean).join('\n');
}
export const summary = makeReportSummary;
