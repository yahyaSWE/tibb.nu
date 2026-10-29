import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyConsultationDetails } from '../src/lib/anamnes/types';
import type { AnamnesDraftControls } from '../src/components/anamnes/use-anamnes-draft';

registerHooks({load(url,context,nextLoad){if(url.endsWith('.css'))return {format:'module',source:'export default new Proxy({}, {get:(_,key)=>String(key)});',shortCircuit:true};return nextLoad(url,context);}});
const controls=():AnamnesDraftControls=>({ready:true,enabled:true,available:null,expiresAt:null,saving:false,message:'',clear:async()=>true,resume:()=>null});
test('AI start has no separate checkbox and keeps the start action explained inside the provider details',async()=>{
  const {AnamnesStartControls}=await import('../src/components/anamnes/start-controls');
  const props={aiAvailable:true,loading:false,providerLabel:'fixture-provider (fixture-model)',privacyNotice:'Synthetic provider information.',onStart:()=>{}};
  const html=renderToStaticMarkup(createElement(AnamnesStartControls,props));
  assert.doesNotMatch(html,/Starta simpel frågeställning|anamnes-ai-start-info|type="checkbox"/);
  assert.match(html,/<button[^>]*>Börja frågorna/);assert.doesNotMatch(html,/<button[^>]+disabled=/);
  assert.match(html,/<details[^>]*><summary>Mer om AI och dina svar<\/summary><p>Genom att välja ”Börja frågorna” samtycker du/);
  assert.match(html,/fixture-provider/);assert.match(html,/Synthetic provider information/);
  const loading=renderToStaticMarkup(createElement(AnamnesStartControls,{...props,loading:true}));assert.match(loading,/<button[^>]+disabled=/);
});
test('the simple start appears only when AI is unavailable, and loading does not flash that choice',async()=>{
  const {AnamnesStartControls}=await import('../src/components/anamnes/start-controls');
  const props={aiAvailable:false,loading:false,providerLabel:'',privacyNotice:'',onStart:()=>{}};
  assert.match(renderToStaticMarkup(createElement(AnamnesStartControls,props)),/Starta simpel frågeställning/);
  const loading=renderToStaticMarkup(createElement(AnamnesStartControls,{...props,loading:true}));assert.doesNotMatch(loading,/Starta simpel/);assert.match(loading,/disabled=""/);
});
test('local draft saving is automatic without a checkbox, with shared-profile and expiry information',async()=>{
  const {AnamnesDraftPanel}=await import('../src/components/anamnes/draft-panel');
  const html=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:controls(),aiAvailable:true,busy:false,onResume:()=>{}}));
  assert.match(html,/sparas automatiskt/);assert.match(html,/24 timmar/);assert.match(html,/samma webbläsarprofil/);
  assert.doesNotMatch(html,/Spara mitt utkast|type="checkbox"|Radera sparat utkast/);
  const saved=controls();saved.expiresAt=Date.now()+10000;
  assert.match(renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:saved,aiAvailable:true,busy:false,onResume:()=>{}})),/Radera sparat utkast/);
});
test('a saved AI draft does not expose answers and requires a new active AI choice on resume',async()=>{
  const {AnamnesDraftPanel}=await import('../src/components/anamnes/draft-panel');
  const saved=controls();saved.available={expiresAt:Date.now()+10000,draft:{version:1,answers:{energy:'low'},narrative:'PRIVATE_STORY_NOT_VISIBLE_BEFORE_RESUME',medicationNames:'PRIVATE_NAMES',consultation:emptyConsultationDetails(),flow:'ai',position:{stage:'interview',questionId:'energy',index:0,history:['energy'],followups:[],round:1}}};
  const html=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:saved,aiAvailable:true,busy:false,onResume:()=>{}}));
  assert.doesNotMatch(html,/PRIVATE_STORY|PRIVATE_NAMES|checked=""/);assert.match(html,/<button[^>]*disabled=""[^>]*>Fortsätt där du slutade/);assert.match(html,/Radera utkastet/);
  const offline=renderToStaticMarkup(createElement(AnamnesDraftPanel,{controls:saved,aiAvailable:false,busy:false,onResume:()=>{}}));assert.doesNotMatch(offline,/<button[^>]*disabled=/);
});
