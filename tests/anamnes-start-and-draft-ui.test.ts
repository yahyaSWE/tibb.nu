import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyConsultationDetails } from '../src/lib/anamnes/types';
import type { AnamnesDraftControls } from '../src/components/anamnes/use-anamnes-draft';

registerHooks({load(url,context,nextLoad){if(url.endsWith('.css'))return {format:'module',source:'export default new Proxy({}, {get:(_,key)=>String(key)});',shortCircuit:true};return nextLoad(url,context);}});
const controls=():AnamnesDraftControls=>({ready:true,enabled:false,available:null,expiresAt:null,saving:false,message:'',enable:()=>{},clear:async()=>true,resume:()=>null});
test('AI start hides the simple flow and the removed paragraph while preserving explicit consent and provider details',async()=>{
  const {AnamnesStartControls}=await import('../src/components/anamnes/start-controls');
  const props={aiAvailable:true,loading:false,providerLabel:'fixture-provider (fixture-model)',privacyNotice:'Synthetic provider information.',accepted:false,onAccepted:()=>{},onStart:()=>{}};
  const html=renderToStaticMarkup(createElement(AnamnesStartControls,props));
  assert.doesNotMatch(html,/Starta simpel frågeställning|anamnes-ai-start-info/);assert.match(html,/type="checkbox"/);assert.doesNotMatch(html,/checked=""/);
  assert.match(html,/<button[^>]+disabled=""[^>]*>Börja frågorna/);assert.match(html,/<details[^>]*><summary>Mer om AI och dina svar<\/summary>/);
  assert.match(html,/fixture-provider/);assert.match(html,/Synthetic provider information/);
  const enabled=renderToStaticMarkup(createElement(AnamnesStartControls,{...props,accepted:true}));assert.doesNotMatch(enabled,/<button[^>]+disabled=/);
});
test('the simple start appears only when AI is unavailable, and loading does not flash that choice',async()=>{
  const {AnamnesStartControls}=await import('../src/components/anamnes/start-controls');
  const props={aiAvailable:false,loading:false,providerLabel:'',privacyNotice:'',accepted:false,onAccepted:()=>{},onStart:()=>{}};
  assert.match(renderToStaticMarkup(createElement(AnamnesStartControls,props)),/Starta simpel frågeställning/);
  const loading=renderToStaticMarkup(createElement(AnamnesStartControls,{...props,loading:true}));assert.doesNotMatch(loading,/Starta simpel/);assert.match(loading,/disabled=""/);
});
test('local draft saving is optional and off initially, with shared-profile and expiry information',async()=>{
  const {AnamnesDraftPanel}=await import('../src/components/anamnes/draft-panel');
  const html=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:controls(),aiAvailable:true,busy:false,onResume:()=>{}}));
  assert.match(html,/Spara mitt utkast/);assert.match(html,/24 timmar/);assert.match(html,/samma webbläsarprofil/);assert.doesNotMatch(html,/checked=""/);
});
test('a saved AI draft does not expose answers and requires a new active AI choice on resume',async()=>{
  const {AnamnesDraftPanel}=await import('../src/components/anamnes/draft-panel');
  const saved=controls();saved.available={expiresAt:Date.now()+10000,draft:{version:1,answers:{energy:'low'},narrative:'PRIVATE_STORY_NOT_VISIBLE_BEFORE_RESUME',medicationNames:'PRIVATE_NAMES',consultation:emptyConsultationDetails(),flow:'ai',position:{stage:'interview',questionId:'energy',index:0,history:['energy'],followups:[],round:1}}};
  const html=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:saved,aiAvailable:true,busy:false,onResume:()=>{}}));
  assert.doesNotMatch(html,/PRIVATE_STORY|PRIVATE_NAMES|checked=""/);assert.match(html,/<button[^>]*disabled=""[^>]*>Fortsätt där du slutade/);assert.match(html,/Radera utkastet/);
  const offline=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:saved,aiAvailable:false,busy:false,onResume:()=>{}}));assert.doesNotMatch(offline,/<button[^>]*disabled=/);
});
