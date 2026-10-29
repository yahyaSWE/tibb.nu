import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildReport } from "../src/lib/anamnes/engine";
import type { AnswerMap } from "../src/lib/anamnes/types";

registerHooks({load(url,context,nextLoad){
  if(url.endsWith('.css'))return {format:'module',source:'export default new Proxy({}, {get:(_,key)=>String(key)});',shortCircuit:true};
  return nextLoad(url,context);
}});
const props = () => ({
  config:{available:true,consentVersion:"fixture-version",retentionDays:30,notice:"Synthetic storage information for a technical fixture."},
  contact:{name:"",email:"",phone:""},onContactChange:()=>{},accepted:false,onAccepted:()=>{},onSubmit:()=>{},busy:false,error:"",submission:null,
  preview:createElement("p",null,"Synthetic preview"),source:"rules" as const,hasReceipt:false,onCopy:()=>{},copied:false,
});

test("completed anamnes has a prominent unsent action and a closed dialog with required contact fields and an unchecked sending choice",async()=>{
  const {AnamnesSubmissionPanel}=await import('../src/components/anamnes/submission-panel');
  const html=renderToStaticMarkup(createElement(AnamnesSubmissionPanel,props()));
  assert.match(html,/Inte inskickad än/);assert.match(html,/Sista steget: skicka till behandlaren/);
  assert.match(html,/<button[^>]*type="button"[^>]*>[\s\S]*?Skicka till behandlaren<\/button>/);
  const dialog=html.match(/<dialog\b[\s\S]*?<\/dialog>/)![0];
  assert.doesNotMatch(dialog.match(/<dialog[^>]*>/)![0],/\bopen(?:=|\s|>)/);
  const name=dialog.match(/<input[^>]*name="name"[^>]*>/)![0];
  const email=dialog.match(/<input[^>]*name="email"[^>]*>/)![0];
  assert.match(name,/required=""/);assert.match(email,/type="email"/);assert.match(email,/required=""/);
  assert.doesNotMatch(dialog.match(/<input[^>]*name="phone"[^>]*>/)![0],/required/);
  const choice=dialog.match(/<input[^>]*name="sendConsent"[^>]*>/)![0];
  assert.match(choice,/required=""/);assert.doesNotMatch(choice,/checked=""/);
  assert.match(dialog,/Skicka min anamnes till behandlaren/);
  assert.doesNotMatch(dialog.match(/<button[^>]*type="submit"[^>]*>/)![0],/disabled=/);
  assert.doesNotMatch(html,/Underlaget har tagits emot|Inskickat<\/p>/);
});

test("sending failures stay in the dialog and preserve contact fields without claiming receipt; busy form prevents repeat submits",async()=>{
  const {AnamnesSubmissionPanel}=await import('../src/components/anamnes/submission-panel');
  const html=renderToStaticMarkup(createElement(AnamnesSubmissionPanel,{...props(),contact:{name:"Synthetic Name",email:"synthetic@example.test",phone:""},accepted:true,error:"Synthetic retry message"}));
  const dialog=html.match(/<dialog\b[\s\S]*?<\/dialog>/)![0];
  assert.match(dialog,/role="alert"[^>]*>Synthetic retry message/);
  assert.match(dialog,/value="Synthetic Name"/);assert.match(dialog,/value="synthetic@example.test"/);
  assert.doesNotMatch(html,/Underlaget har tagits emot/);
  const busy=renderToStaticMarkup(createElement(AnamnesSubmissionPanel,{...props(),busy:true}));
  assert.match(busy,/<form[^>]*aria-busy="true"/);assert.match(busy,/<button[^>]*type="submit"[^>]*disabled=""/);
});

test("an acknowledged submission has an unmistakable receipt and no contact fields or further submit action",async()=>{
  const {AnamnesSubmissionPanel}=await import('../src/components/anamnes/submission-panel');
  const html=renderToStaticMarkup(createElement(AnamnesSubmissionPanel,{...props(),contact:{name:"PRIVATE_CONTACT_MUST_NOT_BE_RESHOWN",email:"synthetic@example.test",phone:""},submission:{reference:"00000000-0000-4000-8000-000000000001",expiresAt:"2090-01-01T00:00:00.000Z"}}));
  assert.match(html,/Din anamnes är skickad/);assert.match(html,/Underlaget har tagits emot/);assert.match(html,/00000000-0000-4000-8000-000000000001/);
  assert.doesNotMatch(html,/<form|type="submit"|PRIVATE_CONTACT_MUST_NOT_BE_RESHOWN|Inte inskickad än/);
});

test("unavailable submissions offer copying without a send action, dialog or receipt",async()=>{
  const {AnamnesSubmissionPanel}=await import('../src/components/anamnes/submission-panel');
  const html=renderToStaticMarkup(createElement(AnamnesSubmissionPanel,{...props(),config:{...props().config,available:false}}));
  assert.match(html,/Digital inskickning är inte tillgänglig/);assert.match(html,/Kopiera underlaget/);
  assert.doesNotMatch(html,/<dialog|<form|Skicka till behandlaren|Underlaget har tagits emot/);
});

test("submission action comes before the analysis details but after medical notices, and never replaces an emergency instruction",async()=>{
  const {AnamnesReport}=await import('../src/components/anamnes/report');
  const answers:AnswerMap={adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'};
  const report=buildReport(answers,[]);
  const action=createElement("div",null,"SYNTHETIC_SEND_ACTION");
  const medical={...report,safety:{...report.safety,level:'medical_review' as const,blocksFormulas:true,flags:['SYNTHETIC_PRIORITY_NOTICE']}};
  const html=renderToStaticMarkup(createElement(AnamnesReport,{report:medical,answers,beforeAnalysis:action}));
  assert.ok(html.indexOf('SYNTHETIC_PRIORITY_NOTICE')<html.indexOf('SYNTHETIC_SEND_ACTION'));
  assert.ok(html.indexOf('SYNTHETIC_SEND_ACTION')<html.indexOf('Så har svaren bedömts'));
  const emergency=renderToStaticMarkup(createElement(AnamnesReport,{report:{...medical,safety:{...medical.safety,level:'emergency'}},answers,beforeAnalysis:action}));
  assert.match(emergency,/Avbryt och sök akut hjälp/);assert.doesNotMatch(emergency,/SYNTHETIC_SEND_ACTION/);
});
