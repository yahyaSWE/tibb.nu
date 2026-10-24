import { qualityCases } from '../src/lib/anamnes/quality-cases';
import { compareQualityCases } from '../src/lib/anamnes/quality';

// Offline engineering replay only. Reviewed expectations are read in the
// protected admin view, never by loading production secrets in this script.
const {rows,...metrics}=compareQualityCases(qualityCases);
console.log(JSON.stringify({...metrics,...(process.argv.includes('--cases')?{cases:rows.map(row=>({id:row.id,baselineQuestions:row.baseline.symptomQuestions,adaptiveQuestions:row.adaptive.symptomQuestions,
  baselineState:row.baseline.state,adaptiveState:row.adaptive.state,baselinePatterns:row.baseline.patternIds,adaptivePatterns:row.adaptive.patternIds,orderStable:row.orderStable}))}:{})},null,2));
