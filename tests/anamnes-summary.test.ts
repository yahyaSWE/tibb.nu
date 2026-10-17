import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport } from '../src/lib/anamnes/engine';
import { formulaSeed } from '../src/lib/anamnes/catalog-seed';
import { formatAnamnesSummary } from '../src/lib/anamnes/summary';
import type { AnswerMap } from '../src/lib/anamnes/types';

const answers: AnswerMap = {
  adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',
  focus:'energy',duration:'months',onset:'gradual',trend:'stable',priorAssessment:'yes',temperature:'neutral',thirst:'normal',sweating:'normal',
  energy:'low',appetite:'normal',stool:'normal',sleep:'normal',emotion:'calm',pain:'no',stressDigestion:'no',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',
};

test('a copied AI summary preserves uncertainty instead of presenting rejected rule candidates', () => {
  const report = buildReport(answers,formulaSeed,{source:'ai',acceptedPatternIds:[]});
  assert.ok(report.analysis.patterns.some(pattern => pattern.qualified));
  const summary = formatAnamnesSummary(report,answers);
  assert.match(summary,/AI-assisterad/);
  assert.match(summary,/Ingen tydlig huvudförklaring/);
  assert.doesNotMatch(summary,/Qi Xue Liang Xu|Ba Zhen Tang/);
  assert.match(summary,/Blir rösten svag eller trött lätt\? Ja/);
  assert.doesNotMatch(summary,/https?:\/\//);
});

test('an emergency summary contains the care direction and answers, with no pattern or formula section', () => {
  const input: AnswerMap = {...answers,emergency:'yes'};
  const summary = formatAnamnesSummary(buildReport(input,formulaSeed),input);
  assert.match(summary,/Ring 112/);
  assert.doesNotMatch(summary,/PRELIMINÄRA TCM-MÖNSTER|FORMELREFERENSER|Ba Zhen Tang/);
  assert.match(summary,/tecken på allvarlig allergisk reaktion\? Ja/);
});
