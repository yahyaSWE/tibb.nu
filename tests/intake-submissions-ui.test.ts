import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntakeContactSchema } from '../src/lib/intake-contact';
import { QUESTIONS } from '../src/lib/five-phases/questions';

registerHooks({load(url,context,nextLoad){
  if(url.endsWith('.css'))return {format:'module',source:'export default new Proxy({}, {get: (_, key) => String(key)});',shortCircuit:true};
  return nextLoad(url,context);
}});

test('both intake forms use required accessible name/email fields and an optional telephone',async()=>{
  const {IntakeContactFields}=await import('../src/components/intake/contact-fields');
  const value=IntakeContactSchema.parse({name:'Synthetic <script>not code</script>',email:'synthetic@example.test',phone:''});
  const html=renderToStaticMarkup(createElement(IntakeContactFields,{prefix:'synthetic-contact',value,onChange:()=>{}}));
  assert.match(html,/for="synthetic-contact-name"/);assert.match(html,/id="synthetic-contact-name"[^>]*required=""/);
  assert.match(html,/id="synthetic-contact-email"[^>]*type="email"[^>]*required=""/);
  const phone=html.match(/<input[^>]*id="synthetic-contact-phone"[^>]*>/)![0];
  assert.match(phone,/type="tel"/);assert.doesNotMatch(phone,/required/);assert.match(html,/Telefon \(valfritt\)/);
  assert.match(html,/&lt;script&gt;not code&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
  const disabled=renderToStaticMarkup(createElement(IntakeContactFields,{prefix:'synthetic-contact',value,onChange:()=>{},disabled:true}));
  assert.equal((disabled.match(/disabled=""/g)??[]).length,3);
});

test('completed self-test initially offers a collapsed, voluntary submission without rendered personal answers',async()=>{
  const {SelfTestSubmissionForm}=await import('../src/components/five-phases/submission-form');
  const html=renderToStaticMarkup(createElement(SelfTestSubmissionForm,{answers:QUESTIONS.map(question=>({questionId:question.id,value:3 as const}))}));
  assert.match(html,/<details[^>]*><summary>Skicka mina svar och mitt resultat till Tibb.nu<\/summary>/);
  assert.doesNotMatch(html,/<details[^>]* open/);
  assert.match(html,/Du behöver inget elevkonto/);
  assert.doesNotMatch(html,/<form|type="checkbox"|name="email"/);
  assert.doesNotMatch(html,/Jag har ofta en stark drivkraft/);
});
