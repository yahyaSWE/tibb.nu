import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createFirstAdmin, getDb, getUser } from '../src/lib/db';
import type { User } from '../src/lib/types';
import { specialOrderSeed } from '../src/lib/anamnes/special-order-catalog';
import { formulaSeed, legacyFormulaIds } from '../src/lib/anamnes/catalog-seed';
import { deleteFormulaCatalogEntry, getFormulaCatalog, getFormulaCatalogEntry, getFormulaCatalogStock, publicFormulaCatalog, saveFormulaCatalogEntry } from '../src/lib/anamnes/catalog';
import { getAnamnesCase, reviewAnamnesCase, submitAnamnes } from '../src/lib/anamnes/cases';
import { anamnesSubmissionConsentVersion } from '../src/lib/anamnes/config';
import { buildReport } from '../src/lib/anamnes/engine';
import { FormulaRecordSchema, type FormulaRecord, type Report } from '../src/lib/anamnes/types';

// This file is deliberately outside the *.test.ts glob. The wrapper must own
// the database path and remove all external-service credentials before import.
assert.equal(process.env.ANAMNES_SUPPLIER_TEST_FIXTURE,'1','Run the isolated supplier backend test wrapper.');
assert.match(process.env.TIBB_DATABASE_PATH ?? '',/tibb-anamnes-supplier-[^/\\]+[/\\]owned-fixture\.sqlite$/);
for (const key of Object.keys(process.env)) assert.ok(!/^(TURSO_|VERCEL|STRIPE_|RESEND_|SMTP_|MAIL_|APP_URL$|SETUP_TOKEN$)/.test(key),'External-service configuration must be stripped by the wrapper.');

let admin: User;
let student: User;
let networkRequests = 0;
const originalFetch = globalThis.fetch;
const originalLegacy = new Map<string,FormulaRecord>();
const migrationKey = 'anamnes_supplier_rangejohan_2026_10_v1';
const cleanupKey = 'anamnes_legacy_formula_cleanup_2026_10_v1';
const evidence = 'OWNED SYNTHETIC TEST DOCUMENTATION ONLY. This does not verify any actual supplier product.';
let historicalCase: { id: string; encrypted: string; report: Report };

before(async () => {
  globalThis.fetch = async () => { networkRequests++; throw new Error('Network is forbidden in the isolated supplier fixture.'); };
  admin = await createFirstAdmin({name:'Synthetic supplier reviewer',email:'supplier-reviewer@example.test',passwordHash:'synthetic-not-a-password'});
  const inserted = await getDb().prepare("INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,'student',?)").run('Synthetic supplier student','supplier-student@example.test','synthetic',new Date().toISOString());
  student = (await getUser(Number(inserted.lastInsertRowid)))!;
  const now = new Date().toISOString();
  // Simulate a populated old installation, not an empty newly seeded catalog.
  for (const [index,id] of legacyFormulaIds.entries()) {
    const previous = FormulaRecordSchema.parse({
      ...formulaSeed[index],id,name:`Retained historical formula ${id}`,pinyin:id,supplierProfile:null,
      requiresVerification:false,verificationResolution:'',productId:900+index,productUrl:`/legacy/${id}`,
      ingredients:[`historical ingredient ${index}`],productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,
      identityEvidence:evidence,ingredientEvidence:evidence,safetyEvidence:evidence,regulatoryEvidence:evidence,
    });
    originalLegacy.set(id,previous);
    await getDb().prepare('INSERT INTO anamnes_formulas(id,data_json,updated_at) VALUES(?,?,?)').run(id,JSON.stringify(previous),now);
  }
  await getDb().prepare("INSERT INTO app_meta(key,value) VALUES('anamnes_catalog_seed_v2','1')").run();
  enableOwnedIntake();
  const answers = {adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no',focus:'energy',duration:'months',onset:'gradual',trend:'stable',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired',temperature:'neutral',currentInfection:'no'};
  const legacyFormula = {...formulaSeed.find(item => item.id === 'supplier-womens')!,id:'ba-zhen-tang',name:'Ba Zhen Tang'};
  const report = buildReport(answers,[legacyFormula]);
  assert.equal(report.formulaMatches[0]?.formulaId,'ba-zhen-tang');
  const id = randomUUID();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',Buffer.from(process.env.ANAMNES_STORAGE_KEY!,'hex'),iv);
  cipher.setAAD(Buffer.from(`case:${id}`));
  const payload = {intake:{answers},report,contact:{name:'Historical synthetic visitor',email:'history@example.test',phone:''},sendConsentAt:now};
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  const encrypted = `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  await getDb().prepare('INSERT INTO anamnes_cases(id,encrypted_payload,created_at,expires_at) VALUES(?,?,?,?)').run(id,encrypted,now,new Date(Date.now()+86400000).toISOString());
  historicalCase = {id,encrypted,report};
});

after(async () => {
  assert.equal(networkRequests,0,'No provider, mail or remote database request is permitted.');
  globalThis.fetch = originalFetch;
  await getDb().close();
});

test('migration removes the original ten catalog entries and preserves encrypted historical formula references', async () => {
  assert.equal(await getDb().prepare('SELECT value FROM app_meta WHERE key=?').get(migrationKey),undefined);
  const catalog = await getFormulaCatalog();
  assert.equal(catalog.length,21);
  assert.deepEqual(catalog.filter(item => item.active).map(item => item.id).sort(),[...formulaSeed,...specialOrderSeed].map(item => item.id).sort());
  for (const id of originalLegacy.keys()) {
    const row = await getDb().prepare('SELECT data_json FROM anamnes_formulas WHERE id=?').get(id);
    assert.equal(row,undefined,id);
  }
  for (const seed of formulaSeed) {
    const item = catalog.find(entry => entry.id === seed.id)!;
    assert.equal(item.productId,null);
    assert.equal(item.productUrl,null);
    assert.equal(item.productIdentityVerified,false);
    assert.equal(item.ingredientsVerified,false);
    assert.equal(item.safetyVerified,false);
    assert.equal(item.regulatoryVerified,false);
    assert.deepEqual(item.supplierProfile,seed.supplierProfile);
    assert.deepEqual(item.ingredients,seed.ingredients);
  }
  assert.equal((await getDb().prepare('SELECT value FROM app_meta WHERE key=?').get(migrationKey))?.value,'1');
  assert.equal((await getDb().prepare('SELECT value FROM app_meta WHERE key=?').get(cleanupKey))?.value,'1');
  assert.equal((await getDb().prepare('SELECT encrypted_payload FROM anamnes_cases WHERE id=?').get(historicalCase.id))?.encrypted_payload,historicalCase.encrypted);
  assert.deepEqual((await getAnamnesCase(admin,historicalCase.id))?.report,historicalCase.report);
});

test('cleanup also runs on an already migrated installation without reseeding or changing later administrator records', async () => {
  const snapshots = await getDb().prepare('SELECT id,data_json,updated_at FROM anamnes_formulas ORDER BY id').all();
  const removed = snapshots.find(row => row.id === 'supplier-four-marvel')!;
  const legacy = originalLegacy.get(legacyFormulaIds[0])!;
  await getDb().prepare('INSERT INTO anamnes_formulas(id,data_json,updated_at) VALUES(?,?,?)').run(legacy.id,JSON.stringify({...legacy,active:false}),new Date().toISOString());
  const custom = {...formulaSeed[0],id:'synthetic-pre-cleanup-addition',name:'Synthetic administrator addition',supplierProfile:null,active:true};
  await getDb().prepare('INSERT INTO anamnes_formulas(id,data_json,updated_at) VALUES(?,?,?)').run(custom.id,JSON.stringify(custom),new Date().toISOString());
  await getDb().prepare('DELETE FROM anamnes_formulas WHERE id=?').run(String(removed.id));
  await getDb().prepare('DELETE FROM app_meta WHERE key=?').run(cleanupKey);
  const catalog = await getFormulaCatalog();
  assert.ok(!catalog.some(item => legacyFormulaIds.some(id => id === item.id)));
  assert.ok(!catalog.some(item => item.id === removed.id),'cleanup must not reinsert an administrator-deleted supplier entry');
  assert.equal(catalog.find(item => item.id === custom.id)?.active,true);
  for (const previous of snapshots.filter(row => row.id !== removed.id)) assert.deepEqual(await getDb().prepare('SELECT id,data_json,updated_at FROM anamnes_formulas WHERE id=?').get(String(previous.id)),previous);
  assert.deepEqual((await getAnamnesCase(admin,historicalCase.id))?.report,historicalCase.report);
  await getDb().prepare('DELETE FROM anamnes_formulas WHERE id=?').run(custom.id);
  await getDb().prepare('INSERT INTO anamnes_formulas(id,data_json,updated_at) VALUES(?,?,?)').run(String(removed.id),String(removed.data_json),String(removed.updated_at));
});

test('initialization respects later admin edits, additions, inactivation and deletion without reseeding', async () => {
  const original = (await getFormulaCatalogEntry('supplier-auranthii'))!;
  await saveFormulaCatalogEntry(admin,{...original,active:false,theoryExplanation:'Synthetic administrator-edited explanation retained after initialization.'});
  const custom = await saveFormulaCatalogEntry(admin,{
    ...formulaSeed[0],id:'synthetic-future-formula',name:'Synthetic future reference',updatedAt:undefined,
    supplierProfile:null,ingredients:['synthetic future ingredient'],active:true,
  });
  assert.equal((await getFormulaCatalogEntry(original.id))?.active,false);
  assert.match((await getFormulaCatalogEntry(original.id))!.theoryExplanation,/administrator-edited/);
  assert.equal((await getFormulaCatalogEntry(custom.id))?.active,true);
  await getFormulaCatalog();
  assert.equal((await getFormulaCatalogEntry(custom.id))?.active,true);
  const removed = (await getFormulaCatalogEntry('supplier-four-marvel'))!;
  await deleteFormulaCatalogEntry(admin,removed.id,removed.updatedAt);
  assert.equal(await getFormulaCatalogEntry(removed.id),null);
  await getFormulaCatalog();
  assert.equal(await getFormulaCatalogEntry(removed.id),null);
});

test('public DTOs redact private supplier profiles and actual evidence while leaving educational product labels', async () => {
  const internal = (await getFormulaCatalogEntry('supplier-relax-resolve'))!;
  assert.ok(internal.supplierProfile!.indications.some(item => item.text === 'Coronary heart disease (CHD)'));
  const catalog = await publicFormulaCatalog();
  assert.ok(catalog.every(item => item.active && !legacyFormulaIds.some(id => id === item.id)));
  for (const item of catalog) {
    assert.equal(item.supplierProfile,null);
    assert.equal(item.referenceSource,null);
    assert.equal(item.verificationResolution,'');
    assert.equal(item.classicalSource,'');
    assert.equal(item.identityEvidence,'');
    assert.equal(item.ingredientEvidence,'');
    assert.equal(item.safetyEvidence,'');
    assert.equal(item.regulatoryEvidence,'');
    assert.deepEqual(item.ingredients,[]);
    assert.equal(item.productId,null);
    assert.equal(item.productUrl,null);
  }
  const encoded = JSON.stringify(catalog);
  assert.ok(!encoded.includes('Coronary heart disease'));
  assert.ok(!encoded.includes('documentSha256'));
  assert.ok(!encoded.includes('traditionalDescription'));
  assert.ok(!encoded.includes('ingredientStatement'));
  assert.ok(!encoded.includes(evidence));
  assert.equal(catalog.find(item => item.id === 'supplier-relax-resolve')?.pinyin,'Hua Yu Xiao Yao San');
});

test('special-order source remains an immutable original and activation/deletion are respected after seeding', async () => {
  const original=(await getFormulaCatalogEntry('special-book-040'))!;
  assert.equal(original.referenceSource?.productName,'DIGES – BAO HE WAN');
  assert.equal(original.referenceKind,'special_order');
  await assert.rejects(saveFormulaCatalogEntry(student,original),/behörighet/);
  await assert.rejects(saveFormulaCatalogEntry(admin,{...original,referenceSource:null}),/Dokumentkällan/);
  const updated=await saveFormulaCatalogEntry(admin,{...original,active:false});
  assert.ok(!(await publicFormulaCatalog()).some(entry => entry.id===original.id));
  assert.equal((await getFormulaCatalogEntry(original.id))?.active,false,'idempotent migration does not reactivate an edited reference');
  await deleteFormulaCatalogEntry(admin,updated.id,updated.updatedAt);
  assert.equal(await getFormulaCatalogEntry(updated.id),null,'catalog initialization does not resurrect a deleted reference');
});

test('supplier profiles are immutable and ingredient conflicts require a documented resolution before verification', async () => {
  const original = (await getFormulaCatalogEntry('supplier-stomach'))!;
  await assert.rejects(saveFormulaCatalogEntry(student,original),/behörighet/);
  await assert.rejects(saveFormulaCatalogEntry(admin,{...original,supplierProfile:{...original.supplierProfile!,actions:[]}}),/oförändrat original/);
  await assert.rejects(saveFormulaCatalogEntry(admin,{...original,supplierProfile:null}),/oförändrat original/);
  await assert.rejects(saveFormulaCatalogEntry(admin,{...original,requiresVerification:false}),/lösning/);
  await assert.rejects(saveFormulaCatalogEntry(admin,{...original,ingredientsVerified:true,ingredientEvidence:evidence}),/Oklara ingrediensuppgifter/);
  const resolution = 'SYNTHETIC FIXTURE ONLY: supplier correspondence reviewed in this owned test; not a real resolution or product approval.';
  const resolved = await saveFormulaCatalogEntry(admin,{...original,requiresVerification:false,verificationResolution:resolution});
  assert.deepEqual(resolved.supplierProfile,original.supplierProfile);
  assert.equal(resolved.requiresVerification,false);
  assert.equal(resolved.ingredientsVerified,false);
  assert.equal((await publicFormulaCatalog()).find(item => item.id === original.id)?.verificationResolution,'');
  // Resolving a source conflict cannot itself establish product availability.
  assert.equal((await publicFormulaCatalog()).find(item => item.id === original.id)?.productId,null);
  const verified = await saveFormulaCatalogEntry(admin,{
    ...resolved,productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,
    identityEvidence:evidence,ingredientEvidence:evidence,safetyEvidence:evidence,regulatoryEvidence:evidence,
  });
  assert.equal(verified.ingredientsVerified,true);
  assert.equal((await publicFormulaCatalog()).find(item => item.id === original.id)?.productId,null);
});

test('availability and the protected stock overview require verified identity, stock, publication and an enabled shop', async () => {
  const now = new Date().toISOString();
  const inserted = await getDb().prepare("INSERT INTO shop_products(name,slug,price_ore,stock,published,created_at,updated_at) VALUES('Synthetic supplier product','synthetic-supplier-product',100,0,0,?,?)").run(now,now);
  const productId = Number(inserted.lastInsertRowid);
  const original = (await getFormulaCatalogEntry('supplier-womens'))!;
  let saved = await saveFormulaCatalogEntry(admin,{...original,productId});
  const projection = async () => (await publicFormulaCatalog()).find(item => item.id === saved.id)!;
  assert.equal((await projection()).productId,null,'a product link alone does not grant availability');
  saved = await saveFormulaCatalogEntry(admin,{
    ...saved,productIdentityVerified:true,ingredientsVerified:true,safetyVerified:true,regulatoryVerified:true,
    identityEvidence:evidence,ingredientEvidence:evidence,safetyEvidence:evidence,regulatoryEvidence:evidence,
  });
  await assert.rejects(getFormulaCatalogStock(student),/behörighet/);
  assert.equal((await projection()).productId,null);
  await getDb().prepare('UPDATE shop_settings SET enabled=1 WHERE id=1').run();
  await getDb().prepare('UPDATE shop_products SET stock=5 WHERE id=?').run(productId);
  assert.equal((await projection()).productId,null,'draft products remain unavailable');
  await getDb().prepare('UPDATE shop_products SET published=1,stock=0 WHERE id=?').run(productId);
  assert.equal((await projection()).productId,null,'published out-of-stock products remain unavailable');
  const unavailableStock = (await getFormulaCatalogStock(admin)).find(item => item.id === saved.id)!;
  assert.equal(unavailableStock.productId,productId);
  assert.equal(unavailableStock.stock,0);
  assert.equal(unavailableStock.available,false);
  await getDb().prepare('UPDATE shop_products SET stock=5 WHERE id=?').run(productId);
  const available = await projection();
  assert.equal(available.productId,productId);
  assert.equal(available.productUrl,'/butik/synthetic-supplier-product');
  assert.equal(available.supplierProfile,null);
  assert.equal(available.classicalSource,'');
  assert.ok(!JSON.stringify(available).includes(evidence));
  const stock = (await getFormulaCatalogStock(admin)).find(item => item.id === saved.id)!;
  assert.deepEqual([stock.stock,stock.published,stock.shopEnabled,stock.available],[5,true,true,true]);
  await getDb().prepare('UPDATE shop_settings SET enabled=0 WHERE id=1').run();
  assert.equal((await projection()).productId,null,'turning off the shop revokes availability immediately');
  await getDb().prepare('UPDATE shop_settings SET enabled=1 WHERE id=1').run();
  saved = await saveFormulaCatalogEntry(admin,{...saved,safetyVerified:false});
  assert.equal((await projection()).productId,null,'a revoked safety verification cannot be bypassed by stock');
});

function enableOwnedIntake() {
  process.env.ANAMNES_PRIVACY_REVIEWED = '1';
  process.env.ANAMNES_CLINICAL_REVIEWED = '1';
  process.env.ANAMNES_REGULATORY_REVIEWED = '1';
  process.env.ANAMNES_SUBMISSIONS_ENABLED = '1';
  process.env.ANAMNES_STORAGE_KEY = '34'.repeat(32);
  process.env.ANAMNES_SUBMISSION_PRIVACY_NOTICE = 'SYNTHETIC OWNED TEST ONLY: no real patient information is entered in this encrypted local fixture.';
  process.env.ANAMNES_THERAPIST_EMAILS = admin.email;
}

test('structured therapist findings are encrypted, append-only and separate from the original visitor report', async () => {
  enableOwnedIntake();
  const submitted = await submitAnamnes({
    answers:{adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'},
    narrative:'Completely fictional supplier review fixture. No real patient data.',sendConsent:true,
    submissionConsentVersion:anamnesSubmissionConsentVersion(),contact:{name:'Synthetic visitor',email:'synthetic-visitor@example.test'},
  });
  const original = (await getAnamnesCase(admin,submitted.reference))!;
  const input = {
    expectedRevision:0,notes:'Synthetic private reviewer note.',tongueNotes:'Synthetic therapist tongue observation.',pulseNotes:'Synthetic therapist pulse observation.',
    corrections:'Synthetic correction kept separate from visitor answers.',finalAssessment:'Synthetic independent therapist assessment.',
    selectedPrimaryPatternId:'qiBloodYangDeficiency',selectedSecondaryPatternIds:['qiBloodDeficiency','liverBloodDeficiency'],
    selectedFormulaId:'supplier-womens',formulaNotes:'Synthetic formula rationale; no use or dosing recommendation.',
  };
  await assert.rejects(reviewAnamnesCase(student,submitted.reference,input),/behörighet/);
  await assert.rejects(reviewAnamnesCase(admin,submitted.reference,{...input,selectedSecondaryPatternIds:['qiBloodYangDeficiency']}),/olika/);
  await assert.rejects(reviewAnamnesCase(admin,submitted.reference,{...input,selectedFormulaId:legacyFormulaIds[0]}),/aktiv formel/);
  await assert.rejects(reviewAnamnesCase(admin,submitted.reference,{...input,selectedPrimaryPatternId:'invented-pattern'}));
  await reviewAnamnesCase(admin,submitted.reference,input);
  const first = (await getAnamnesCase(admin,submitted.reference))!;
  assert.equal(first.revision,1);
  assert.deepEqual(first.intake,original.intake);
  assert.deepEqual(first.report,original.report);
  assert.equal(first.reviews[0].selectedPrimaryPatternId,input.selectedPrimaryPatternId);
  assert.deepEqual(first.reviews[0].selectedSecondaryPatternIds,input.selectedSecondaryPatternIds);
  assert.equal(first.reviews[0].selectedFormulaId,input.selectedFormulaId);
  assert.equal(first.reviews[0].formulaNotes,input.formulaNotes);
  const raw = await getDb().prepare('SELECT encrypted_payload FROM anamnes_case_reviews WHERE case_id=?').get(submitted.reference);
  assert.match(String(raw!.encrypted_payload),/^v1\./);
  assert.ok(!String(raw!.encrypted_payload).includes('Synthetic'));
  assert.ok(!String(raw!.encrypted_payload).includes('qiBloodYangDeficiency'));
  await assert.rejects(reviewAnamnesCase(admin,submitted.reference,input),/ändrats/);
  await reviewAnamnesCase(admin,submitted.reference,{...input,expectedRevision:1,selectedPrimaryPatternId:'qiBloodDeficiency',selectedSecondaryPatternIds:[],selectedFormulaId:null});
  const second = (await getAnamnesCase(admin,submitted.reference))!;
  assert.equal(second.reviews.length,2);
  assert.deepEqual(second.reviews[0],first.reviews[0]);
  assert.equal(second.reviews[1].selectedPrimaryPatternId,'qiBloodDeficiency');
  assert.equal(second.reviews[1].selectedFormulaId,null);
  assert.deepEqual(second.report,original.report);
});

test('historical encrypted reviews without new structured fields remain readable with neutral defaults', async () => {
  enableOwnedIntake();
  const submitted = await submitAnamnes({answers:{},sendConsent:true,submissionConsentVersion:anamnesSubmissionConsentVersion(),contact:{name:'Historical synthetic visitor',email:'historical-visitor@example.test'}});
  const legacy = {notes:'Synthetic historical note.',tongueNotes:'',pulseNotes:'',corrections:'',finalAssessment:'',revision:1,authorId:admin.id,authorName:admin.name,reviewedAt:new Date().toISOString()};
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',Buffer.from(process.env.ANAMNES_STORAGE_KEY!,'hex'),iv);
  cipher.setAAD(Buffer.from(`review:${submitted.reference}:1`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(legacy),'utf8'),cipher.final()]);
  const encrypted = `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
  await getDb().prepare('UPDATE anamnes_cases SET revision=1 WHERE id=?').run(submitted.reference);
  await getDb().prepare('INSERT INTO anamnes_case_reviews(case_id,revision,encrypted_payload,reviewed_at,author_id) VALUES(?,1,?,?,?)').run(submitted.reference,encrypted,legacy.reviewedAt,admin.id);
  const record = (await getAnamnesCase(admin,submitted.reference))!;
  assert.equal(record.reviews[0].notes,legacy.notes);
  assert.equal(record.reviews[0].selectedPrimaryPatternId,null);
  assert.deepEqual(record.reviews[0].selectedSecondaryPatternIds,[]);
  assert.equal(record.reviews[0].selectedFormulaId,null);
  assert.equal(record.reviews[0].formulaNotes,'');
});
