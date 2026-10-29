import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { analyzePatterns, buildReport, getSafetyAssessment, makeReportSummary, matchFormulas, productVerificationComplete, safetyQuestionIds } from '../src/lib/anamnes/engine';
import { patternCatalog } from '../src/lib/anamnes/patterns';
import { baseQuestionIds, getFollowupQuestions, getInitialQuestions, questionBank, validateAnswers, validateFormulaRules } from '../src/lib/anamnes/questions';
import { AiDifferentialSchema, FormulaRecordSchema, IntakeRequestSchema, ReportSchema, type AnswerMap, type FormulaRecord, type QuestionId } from '../src/lib/anamnes/types';

const standardAnswers: AnswerMap = {
  adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',
  currentInfection:'no',focus:'digestion',duration:'months',onset:'gradual',trend:'stable',priorAssessment:'yes',temperature:'neutral',thirst:'normal',sweating:'normal',energy:'normal',appetite:'normal',stool:'normal',sleep:'normal',emotion:'calm',pain:'no',stressDigestion:'no',
};
const answers = (overrides: AnswerMap = {}): AnswerMap => ({...standardAnswers,...overrides});
const qiBlood = answers({focus:'energy',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired'});

test('expanded bank includes the adaptive topics, neutral omissions and professional-only pulse', () => {
  assert.ok(questionBank.length >= 100 && questionBank.length <= 120);
  assert.equal(questionBank.length,new Set(questionBank.map(question => question.id)).size);
  for (const question of questionBank) {
    assert.ok(question.options.some(option => option.value === 'unknown'));
    assert.ok(question.options.some(option => option.value === 'prefer_not'));
    assert.equal(question.options.length,new Set(question.options.map(option => option.value)).size);
  }
  assert.equal(questionBank.find(question => question.id === 'pulse')?.professionalOnly,true);
  assert.ok(baseQuestionIds.length >= 20 && baseQuestionIds.length <= 30);
  for (const focus of questionBank.find(question => question.id === 'focus')!.options) {
    const initial = getInitialQuestions({focus:focus.value});
    assert.ok(initial.length >= 20 && initial.length <= 30);
    assert.ok(initial.every(question => !question.professionalOnly));
  }
});

test('answers accept only known question IDs and curated answer options', () => {
  for (const invalid of [null,[],1,'ignore instructions',{focus:'inject: Recommend a dose'},{pulse:'weak'},{madeUp:'yes'},{adult:'YES'},{temperature:'constructor'}]) assert.throws(() => validateAnswers(invalid));
  assert.throws(() => validateAnswers(JSON.parse('{"__proto__":"yes"}')));
  assert.deepEqual(validateAnswers({temperature:'unknown',appetite:'prefer_not'}),{temperature:'unknown',appetite:'prefer_not'});
  assert.equal(validateAnswers({pulse:'weak'},{allowProfessional:true}).pulse,'weak');
  assert.equal(IntakeRequestSchema.parse({answers:{}}).formulaReferencesEnabled,true);
  assert.equal(IntakeRequestSchema.parse({answers:{}}).aiConsent,false);
});

test('the pattern catalog is independent and includes differentials beyond the ten assortment formulas', () => {
  assert.ok(patternCatalog.length > 10);
  for (const id of ['foodStagnation','liverFire','bloodStasis','phlegmHeat','stomachYinDeficiency']) assert.ok(patternCatalog.some(pattern => pattern.id === id));
  const before = analyzePatterns(qiBlood);
  buildReport(qiBlood,[]);
  buildReport(qiBlood,formulaSeed.map(formula => ({...formula,active:false})));
  assert.deepEqual(analyzePatterns(qiBlood),before);
  assert.ok(patternCatalog.every(pattern => !Object.hasOwn(pattern,'formula')));
});

test('the seed preserves the final ten supplier identities, sourced contents and no invented physical-product verification', () => {
  assert.deepEqual(formulaSeed.map(formula => formula.name),['Athletic Herbs','Coptis & Scute Herbs','Tonic Herbs','Stomach Herbs','Four Marvel Herbs','Relax & Resolve Herbs','Six Herbs',"Women's Herbs",'SLBZ Herbs','Auranthii Herbs']);
  for (const formula of formulaSeed) {
    assert.equal(FormulaRecordSchema.safeParse(formula).success,true);
    assert.equal(validateFormulaRules(formula),true);
    assert.ok(formula.ingredients.length > 0);
    assert.match(formula.classicalSource,/rangejohan\.pdf/);
    assert.equal(formula.supplierProfile?.productName,formula.name);
    assert.match(formula.supplierProfile?.documentSha256 ?? '',/^[a-f0-9]{64}$/);
    assert.equal(formula.productId,null);
    assert.equal(formula.identityEvidence,'');
    assert.equal(formula.ingredientEvidence,'');
    assert.equal(formula.safetyEvidence,'');
    assert.equal(formula.regulatoryEvidence,'');
    assert.equal(productVerificationComplete(formula),false);
  }
});

test('every omitted, unknown and withheld safety answer blocks formula references', () => {
  for (const id of safetyQuestionIds) {
    for (const value of [undefined,'unknown','prefer_not']) {
      const input = {...qiBlood};
      if (value === undefined) delete input[id]; else input[id] = value;
      const result = buildReport(input,formulaSeed);
      assert.equal(result.safety.blocksFormulas,true,`${id}:${value}`);
      assert.deepEqual(result.formulaMatches,[]);
      assert.ok(result.safety.missingQuestionIds.includes(id));
    }
  }
});

test('an explicitly uncertain joint safety response in a pain history blocks formulas in both analysis modes', () => {
  const input: AnswerMap = {...qiBlood,focus:'pain'};
  const independent = analyzePatterns(input);
  assert.equal(getSafetyAssessment(input).level,'clear','an unasked discriminator must remain available to the interview');
  assert.ok(buildReport(input,formulaSeed).formulaMatches.length > 0);
  for (const jointWarmth of ['unknown','prefer_not']) {
    const uncertain = {...input,jointWarmth};
    for (const source of ['rules','ai'] as const) {
      const report = buildReport(uncertain,formulaSeed,{source,acceptedPatternIds:['qiBloodDeficiency']});
      assert.equal(report.safety.level,'incomplete');
      assert.ok(report.safety.missingQuestionIds.includes('jointWarmth'));
      assert.equal(report.formulaStatus,'safety_blocked');
      assert.deepEqual(report.formulaMatches,[]);
      assert.deepEqual(report.analysis,independent,'safety gate does not change independent qualification thresholds');
    }
  }
  assert.equal(getSafetyAssessment({...input,jointWarmth:'no'}).level,'clear');
  assert.equal(getSafetyAssessment({...input,jointWarmth:'yes'}).level,'medical_review');
});

test('deterministic emergency and higher-risk gates cannot be overridden by AI IDs or catalog changes', () => {
  const risks: AnswerMap[] = [{adult:'no'},{pregnancy:'yes'},{chronicDisease:'yes'},{liverKidney:'yes'},{allergy:'yes'},{clinicalRedFlags:'yes'},{jointWarmth:'yes'},{urination:'burning'},{chestTightness:'yes'},{breathing:'yes'},{palpitations:'yes',priorAssessment:'no'},{trend:'worsening',priorAssessment:'no'}];
  for (const risk of risks) {
    const result = buildReport({...qiBlood,...risk},formulaSeed,{source:'ai',acceptedPatternIds:['qiBloodDeficiency']});
    assert.equal(result.safety.blocksFormulas,true);
    assert.equal(result.formulaStatus,'safety_blocked');
    assert.deepEqual(result.formulaMatches,[]);
  }
  const stopped = buildReport({...qiBlood,emergency:'yes'},formulaSeed);
  assert.equal(stopped.safety.level,'emergency');
  assert.equal(stopped.analysis.primary,null);
  assert.deepEqual(stopped.analysis.patterns,[]);
  assert.deepEqual(stopped.analysis.zangFu,[]);
  assert.deepEqual(stopped.followUpQuestionIds,[]);
  assert.match(stopped.safety.flags.join(' '),/112/);
});

test('insufficient and contradictory answers do not force a primary pattern or formula', () => {
  for (const input of [{},standardAnswers,answers({energy:'low'})]) {
    const result = buildReport(input,formulaSeed);
    assert.equal(result.analysis.primary,null);
    assert.equal(result.analysis.status,'insufficient');
    assert.deepEqual(result.formulaMatches,[]);
  }
  const conflict = buildReport({...qiBlood,temperature:'cold',thirst:'strong_cold',hotPalms:'yes'},formulaSeed);
  assert.equal(conflict.analysis.status,'conflicting');
  assert.equal(conflict.analysis.primary,null);
  assert.ok(conflict.analysis.conflicts.length > 0);
  assert.deepEqual(conflict.formulaMatches,[]);
});

test('stress-related digestion alone cannot manufacture a Relax and Resolve composite match', () => {
  const input = answers({energy:'low',appetite:'low',stool:'loose',stressDigestion:'yes',ribTension:'yes',afterMealBloat:'yes'});
  const result = buildReport(input,formulaSeed);
  assert.ok(result.analysis.patterns.some(pattern => pattern.id === 'liverInvadesSpleen' && pattern.qualified));
  assert.ok(!result.analysis.patterns.find(pattern => pattern.id === 'liverSpleenBloodDeficiency')?.qualified);
  assert.equal(result.formulaStatus,'no_match');
  assert.ok(result.formulaMatches.every(formula => formula.formulaId !== 'supplier-relax-resolve'));
});

test('dominant out-of-assortment food stagnation and blood stasis return an explicit no-match', () => {
  const examples = [
    answers({pain:'yes',foodTrigger:'yes',reflux:'sour',afterMealBloat:'yes',stoolOdor:'yes',onset:'after_food',abdominalPain:'distending',nausea:'yes'}),
    answers({focus:'pain',pain:'yes',painCharacter:'stabbing',tongueColor:'purple',menstrualPain:'clots_pain',abdominalPain:'sharp'}),
  ];
  for (const input of examples) {
    const report = buildReport(input,formulaSeed);
    assert.equal(report.analysis.status,'preliminary');
    assert.ok(['foodStagnation','bloodStasis'].includes(report.analysis.primary?.id ?? ''));
    assert.equal(report.formulaStatus,'no_match');
    assert.deepEqual(report.formulaMatches,[]);
    assert.match(makeReportSummary(input,report),/Ingen av de aktiva sortimentsformlerna passar/);
  }
});

test('evidence names only actual answered observations and separates support, opposition and missing', () => {
  const input = answers({energy:'low',appetite:'low',stool:'loose',temperature:'hot',tongueTeeth:'unknown'});
  const analysis = analyzePatterns(input);
  const finding = analysis.patterns.find(pattern => pattern.id === 'spleenQiDeficiency')!;
  assert.ok(finding.supporting.some(evidence => evidence.questionId === 'energy'));
  assert.ok(finding.opposing.some(evidence => evidence.questionId === 'temperature'));
  assert.ok(finding.missingQuestionIds.includes('afterMealBloat'));
  for (const pattern of analysis.patterns) for (const evidence of [...pattern.supporting,...pattern.opposing]) {
    assert.equal(input[evidence.questionId],evidence.answer);
    assert.ok(!['unknown','prefer_not'].includes(evidence.answer));
    assert.ok(questionBank.find(question => question.id === evidence.questionId)?.prompt && evidence.label);
  }
});

test('adaptive follow-ups are at most five unique unanswered bank questions and exclude pulse', () => {
  const analysis = analyzePatterns(qiBlood);
  const selected: QuestionId[] = ['pulse','adult','energy','nausea','reflux','pallor','tongueCracks','tongueShape','urination'];
  const followups = getFollowupQuestions(qiBlood,analysis,selected);
  assert.ok(followups.length <= 5);
  assert.equal(followups.length,new Set(followups.map(question => question.id)).size);
  assert.ok(followups.every(question => !question.professionalOnly && !qiBlood[question.id]));
  const initial = new Set(getInitialQuestions(qiBlood).map(question => question.id));
  assert.ok(followups.every(question => !initial.has(question.id)));
});

test('curated formula matches are default-enabled, ranked, limited to three, partial and never seed products', () => {
  const report = buildReport(qiBlood,formulaSeed);
  assert.equal(report.formulaReferencesEnabled,true);
  assert.equal(report.formulaStatus,'matched');
  assert.equal(report.formulaMatches[0].name,"Women's Herbs");
  const partialAnswers = {...qiBlood};
  delete partialAnswers.dizziness;
  const partial = buildReport(partialAnswers,formulaSeed).formulaMatches[0];
  assert.ok(partial.partial);
  assert.match(partial.limitation,/inte säkert hela symtombilden/);
  assert.equal(report.formulaMatches[0].productAvailable,false);
  assert.equal(report.formulaMatches[0].productUrl,null);
  assert.equal(ReportSchema.safeParse(report).success,true);
  const base = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const expanded = [1,2,3,4,5].map(index => ({...base,id:`added-${index}`,name:`Ny referens ${index}`}));
  const result = matchFormulas(report.analysis,qiBlood,expanded);
  assert.equal(result.length,3);
  assert.ok(result.every((formula,index) => !index || result[index-1].score >= formula.score));
  const disabled = buildReport(qiBlood,formulaSeed,{formulaReferencesEnabled:false});
  assert.equal(disabled.formulaStatus,'disabled');
  assert.deepEqual(disabled.formulaMatches,[]);
});

test('admin-managed additions, deactivation and pattern mapping require no AI-code changes', () => {
  const liverFire = answers({temperature:'hot',thirst:'strong_cold',irritability:'yes',emotion:'irritable',tongueColor:'red',constipation:'yes'});
  const report = buildReport(liverFire,formulaSeed);
  assert.equal(report.formulaStatus,'no_match');
  const addition: FormulaRecord = {...formulaSeed[0],id:'new-reviewed-reference',name:'Administrerad referens',primaryPatternIds:['liverFire'],requiredPatternIds:['liverFire'],secondaryPatternIds:[],supportingRules:[],opposingRules:[],contraindicationRules:[],requiredSafetyRules:[],requiredQuestionIds:[],supplierProfile:null,requiresVerification:false};
  assert.equal(buildReport(liverFire,[addition]).formulaStatus,'matched');
  assert.equal(buildReport(liverFire,[{...addition,active:false}]).formulaStatus,'no_match');
  assert.equal(validateFormulaRules({...addition,supportingRules:[{questionId:'energy',values:['arbitrary'],weight:2}]}),false);
  for (const key of ['contraindicationRules','requiredSafetyRules'] as const) {
    for (const invalid of [{questionId:'currentInfection' as const,values:['unknown'],weight:2},{questionId:'temperature' as const,values:['invented'],weight:2},{questionId:'pulse' as const,values:['weak'],weight:2}]) {
      assert.equal(validateFormulaRules({...addition,[key]:[invalid]}),false,`${key} must use reviewed public findings`);
    }
  }
});

test('legacy formula criteria ignore retired background questions but retain missing symptoms and safety gates', () => {
  const input = { ...qiBlood };
  delete input.priorAssessment;
  const base = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const legacy: FormulaRecord = { ...base, requiredQuestionIds: [...base.requiredQuestionIds, 'priorAssessment', 'tongueMoisture'] };
  const report = buildReport(input, [legacy]);
  assert.equal(report.formulaStatus, 'matched');
  const match = report.formulaMatches[0];
  assert.equal(match.missingQuestionIds.includes('priorAssessment'), false);
  assert.equal(match.missingQuestionIds.includes('tongueMoisture'), true);
  assert.equal(match.partial, true);
  assert.deepEqual(report.analysis, analyzePatterns(input), 'retiring a background criterion must not change symptom qualification');
  const completed = buildReport({ ...input, tongueMoisture: 'normal' }, [legacy]);
  assert.equal(completed.formulaMatches[0].missingQuestionIds.includes('tongueMoisture'), false);
  assert.equal(completed.formulaMatches[0].missingQuestionIds.includes('priorAssessment'), false);
  for (const risk of [{ pregnancy: 'yes' }, { emergency: 'yes' }] satisfies AnswerMap[]) {
    const blocked = buildReport({ ...input, ...risk }, [legacy]);
    assert.equal(blocked.safety.blocksFormulas, true);
    assert.deepEqual(blocked.formulaMatches, []);
  }
});

test('a real product is exposed only with all verified evidence, ingredients and a server-enriched internal product URL', () => {
  const base = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const verified: FormulaRecord = {...base,productId:1,productUrl:'/butik/verifierad-produkt',ingredients:['Verifierad dokumenterad råvara'],productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,identityEvidence:'Dokumenterat och självständigt granskat produktunderlag',ingredientEvidence:'Dokumenterat och självständigt granskat produktunderlag',safetyEvidence:'Dokumenterat och självständigt granskat produktunderlag',regulatoryEvidence:'Dokumenterat och självständigt granskat produktunderlag'};
  assert.equal(buildReport(qiBlood,[verified]).formulaMatches[0].productAvailable,true);
  for (const key of ['productIdentityVerified','ingredientsVerified','safetyVerified','regulatoryVerified'] as const) assert.equal(buildReport(qiBlood,[{...verified,[key]:false}]).formulaMatches[0].productAvailable,false);
  for (const key of ['identityEvidence','ingredientEvidence','safetyEvidence','regulatoryEvidence'] as const) assert.equal(buildReport(qiBlood,[{...verified,[key]:''}]).formulaMatches[0].productAvailable,false);
  for (const productUrl of [null,'https://example.com/buy','//example.com/','/butik/foo?buy=1','javascript:alert(1)']) {
    const formula = buildReport(qiBlood,[{...verified,productUrl}]).formulaMatches[0];
    assert.equal(formula.productAvailable,false);
    assert.equal(formula.productUrl,null);
    assert.equal(formula.productId,null);
  }
  assert.equal(buildReport(qiBlood,[{...verified,productId:null}]).formulaMatches[0].productAvailable,false);
  assert.equal(buildReport(qiBlood,[{...verified,ingredients:[]}]).formulaMatches[0].productAvailable,false);
});

test('AI output permits only catalog IDs, cannot add free text and cannot invent an unsupported pattern', () => {
  for (const output of [{patternIds:['invented'],followUpQuestionIds:[]},{patternIds:[],followUpQuestionIds:['notAQuestion']},{patternIds:[],followUpQuestionIds:[],recommendation:'Take a dose'},{patternIds:[],followUpQuestionIds:Array(6).fill('pallor')}]) assert.equal(AiDifferentialSchema.safeParse(output).success,false);
  const rules = buildReport(qiBlood,formulaSeed);
  const ai = buildReport(qiBlood,formulaSeed,{source:'ai',acceptedPatternIds:['liverFire'],followUpQuestionIds:['pulse','energy','ribTension']});
  assert.deepEqual(ai.analysis.primary,rules.analysis.primary);
  assert.deepEqual(ai.formulaMatches,rules.formulaMatches);
  assert.ok(!ai.followUpQuestionIds.includes('pulse'));
  assert.equal(getSafetyAssessment(answers()).blocksFormulas,false);
});

test('explicit AI uncertainty suppresses a primary, alternatives and formulas while retaining independent rule provenance', () => {
  const rules = buildReport(qiBlood,formulaSeed);
  assert.equal(rules.analysis.status,'preliminary');
  assert.ok(rules.analysis.primary);
  assert.ok(rules.formulaMatches.length > 0);
  const uncertain = buildReport(qiBlood,formulaSeed,{source:'ai',acceptedPatternIds:[]});
  assert.equal(uncertain.analysis.status,'insufficient');
  assert.equal(uncertain.analysis.primary,null);
  assert.deepEqual(uncertain.analysis.secondary,[]);
  assert.deepEqual(uncertain.analysis.zangFu,[]);
  assert.deepEqual(uncertain.analysis.patterns,rules.analysis.patterns);
  assert.equal(uncertain.formulaStatus,'insufficient');
  assert.deepEqual(uncertain.formulaMatches,[]);
  assert.equal(ReportSchema.safeParse(uncertain).success,true);
  // Absence of an AI result is a different case: normal rules fallback remains.
  assert.deepEqual(buildReport(qiBlood,formulaSeed,{source:'rules',acceptedPatternIds:[]}).analysis,rules.analysis);
});

test('formula-specific evidence weights determine ranking without double-counting shared pattern findings', () => {
  const base = formulaSeed.find(formula => formula.id === 'supplier-womens')!;
  const profile = (id: string,weight: number): FormulaRecord => ({
    ...base,id,name:id,supportingRules:[
      {questionId:'energy',values:['low'],weight},
      {questionId:'pallor',values:['yes'],weight},
      {questionId:'dizziness',values:['yes'],weight},
    ],
  });
  const result = buildReport(qiBlood,[profile('aaa-lower-weight',2),profile('zzz-higher-weight',5)]).formulaMatches;
  assert.equal(result.length,2);
  assert.equal(result[0].formulaId,'zzz-higher-weight');
  assert.equal(result[1].formulaId,'aaa-lower-weight');
  assert.equal(result[0].score-result[1].score,9);
  for (const [match,weight] of [[result[0],5],[result[1],2]] as const) {
    assert.equal(match.supporting.find(item => item.questionId === 'energy')?.weight,weight);
    assert.equal(match.supporting.filter(item => item.questionId === 'energy').length,1);
  }
});

test('direct contradictory pain answers keep the differential open rather than selecting a formula', () => {
  for (const contradiction of [{pain:'no',painCharacter:'stabbing'},{pain:'yes',painLocation:'none',painCharacter:'stabbing'}] satisfies AnswerMap[]) {
    const report = buildReport({...qiBlood,...contradiction},formulaSeed);
    assert.equal(report.analysis.status,'conflicting');
    assert.equal(report.analysis.primary,null);
    assert.ok(report.analysis.conflicts.some(message => /smärtkaraktär|buksmärta/.test(message)));
    assert.deepEqual(report.formulaMatches,[]);
  }
  assert.equal(analyzePatterns(answers({pain:'no',painCharacter:'none',abdominalPain:'none'})).conflicts.length,0);
  assert.equal(analyzePatterns(answers({pain:'no',abdominalPain:'sharp'})).conflicts.length,0,'denied musculoskeletal pain does not contradict abdominal pain');
  assert.equal(analyzePatterns(answers({pain:'yes',painCharacter:'none',stiffness:'yes'})).conflicts.length,0);
  assert.equal(analyzePatterns(answers({pain:'unknown',painCharacter:'stabbing'})).conflicts.length,0);
  assert.equal(analyzePatterns(answers({pain:'no',painCharacter:'unknown',abdominalPain:'prefer_not'})).conflicts.length,0);
});

test('Yin/Yang summarizes supported Ba Gang findings with uncertainty and mixed states instead of a fixed diagnosis', () => {
  const coldDeficiency = analyzePatterns({...qiBlood,temperature:'cold'}).baGang.yinYang;
  assert.match(coldDeficiency.value,/Preliminär Yin-prägel/);
  assert.match(coldDeficiency.value,/fastställer inte/);
  assert.ok(coldDeficiency.supporting.some(item => item.questionId === 'temperature'));
  assert.ok(coldDeficiency.supporting.some(item => item.questionId === 'energy'));
  const heatExcess = analyzePatterns(answers({pain:'yes',temperature:'hot',thirst:'strong_cold',foodTrigger:'yes',tongueCoating:'yellow_greasy',painCharacter:'distending'})).baGang.yinYang;
  assert.match(heatExcess.value,/Preliminär Yang-prägel/);
  assert.ok(heatExcess.opposing.some(item => item.questionId === 'temperature'));
  assert.ok(heatExcess.opposing.some(item => item.questionId === 'foodTrigger'));
  const heatDeficiency = analyzePatterns({...qiBlood,temperature:'hot',thirst:'strong_cold',tongueColor:'normal'}).baGang.yinYang;
  assert.match(heatDeficiency.value,/Blandade Yin\/Yang-aspekter/);
  const mixed = analyzePatterns({...qiBlood,temperature:'cold',thirst:'strong_cold',hotPalms:'yes'}).baGang.yinYang;
  assert.match(mixed.value,/Blandade eller motstridiga/);
  for (const input of [{},answers(),answers({temperature:'cold'})]) assert.match(analyzePatterns(input).baGang.yinYang.value,/Otillräckligt underlag/);
});

test('Zang-Fu explains traditional relationships between supported findings instead of listing organ names', () => {
  for (const pattern of patternCatalog) {
    assert.ok(pattern.zangFu.length > 0);
    assert.ok(pattern.zangFu.every(text => text.length > 100 && text.includes('TCM')));
  }
  const qiBloodReport = buildReport(qiBlood,formulaSeed);
  assert.ok(qiBloodReport.analysis.zangFu.some(text => text.includes('Mjälte och Lever') && /låg energi.*blekhet/.test(text)));
  assert.ok(qiBloodReport.analysis.zangFu.every(text => /inte|ingen|varken/.test(text)));
  const liverSpleen = patternCatalog.find(pattern => pattern.id === 'liverInvadesSpleen')!;
  assert.match(liverSpleen.zangFu.join(' '),/stress.*uppblåsthet.*samspel/);
  const heartSpleen = patternCatalog.find(pattern => pattern.id === 'heartSpleenDeficiency')!;
  assert.match(heartSpleen.zangFu.join(' '),/låg energi.*sömnoro.*samspel/);
  const chronicBi = patternCatalog.find(pattern => pattern.id === 'chronicBiDeficiency')!;
  assert.match(chronicBi.zangFu.join(' '),/Bi-mönster och en bristkomponent.*samtidigt/);
  assert.equal(ReportSchema.safeParse(qiBloodReport).success,true);
});
