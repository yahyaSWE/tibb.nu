import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ExtractionObservation } from '../src/lib/anamnes/observations';

registerHooks({load(url,context,nextLoad){if(url.endsWith('.css'))return {format:'module',source:'export default new Proxy({}, {get:(_,key)=>String(key)});',shortCircuit:true};return nextLoad(url,context);}});
test('observation review renders unchecked explicit decisions, editable options and an independent skip action',async()=>{
  const {ObservationReview}=await import('../src/components/anamnes/observation-review');
  const proposals:ExtractionObservation[]=[{questionId:'energy',answer:'low',certainty:'explicit',polarity:'affirmed',evidence:[{source:'narrative',sourceQuestionId:null,excerpt:'<script>untrusted</script> trött'}]}];
  const html=renderToStaticMarkup(createElement(ObservationReview,{proposals,onConfirm:()=>{},onSkip:()=>{},disabled:false}));
  assert.match(html,/type="checkbox"/);assert.doesNotMatch(html,/checked=""/);assert.match(html,/Använd mina bekräftade svar/);assert.match(html,/Hoppa över tolkningen/);
  assert.match(html,/&lt;script&gt;untrusted&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/<select/);
});
test('uncertain interpretations require an option before confirmation and show that ambiguity',async()=>{
  const {ObservationReview}=await import('../src/components/anamnes/observation-review');
  const proposals:ExtractionObservation[]=[{questionId:'energy',answer:null,certainty:'uncertain',polarity:'unknown',evidence:[{source:'narrative',sourceQuestionId:null,excerpt:'Vet inte om jag är trött.'}]}];
  const html=renderToStaticMarkup(createElement(ObservationReview,{proposals,onConfirm:()=>{},onSkip:()=>{},disabled:false}));
  assert.match(html,/Texten är inte entydig/);assert.match(html,/type="checkbox"[^>]*disabled=""/);assert.doesNotMatch(html,/checked=""/);
});
