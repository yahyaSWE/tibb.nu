import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formulaSeed, legacyFormulaIds } from '../src/lib/anamnes/catalog-seed';
import { productVerificationComplete } from '../src/lib/anamnes/engine';
import { validateFormulaRules } from '../src/lib/anamnes/questions';
import { supplierFormulaSources } from '../src/lib/anamnes/supplier-source';
import { FormulaRecordSchema, SupplierProfileSchema } from '../src/lib/anamnes/types';

const expected = [
  ['supplier-athletic','Athletic Herbs','Zhuang Yao Tang',6,[1,2]],
  ['supplier-coptis-scute','Coptis & Scute Herbs','Huang Lian Jie Du Tang',4,[2,3]],
  ['supplier-tonic','Tonic Herbs','Shi Quan Da Bu Tang',12,[3,4]],
  ['supplier-stomach','Stomach Herbs','Xiang Sha Liu Jun Zi Tang',9,[5,6]],
  ['supplier-four-marvel','Four Marvel Herbs','Si Miao San',4,[6,7]],
  ['supplier-relax-resolve','Relax & Resolve Herbs','Hua Yu Xiao Yao San',12,[7,8,9]],
  ['supplier-six','Six Herbs','Liu Wei Di Huang Wan',6,[10,11]],
  ['supplier-womens',"Women's Herbs",'Ba Zhen Tang',8,[11,12]],
  ['supplier-slbz','SLBZ Herbs','Shen Ling Bai Zhu San',9,[13,14]],
  ['supplier-auranthii','Auranthii Herbs','Chai Hu Shu Gan San',7,[15,16]],
] as const;
const sourceById = new Map(supplierFormulaSources.map(source => [source.id,source]));
const formulaById = new Map(formulaSeed.map(formula => [formula.id,formula]));

test('the active seed uses the final ten distinct supplier products, including Auranthii and no legacy identities', () => {
  assert.deepEqual(formulaSeed.map(formula => [formula.id,formula.name,formula.pinyin]),expected.map(([id,name,pinyin]) => [id,name,pinyin]));
  assert.equal(new Set(formulaSeed.map(formula => formula.id)).size,10);
  assert.ok(formulaSeed.every(formula => formula.active));
  assert.equal(legacyFormulaIds.length,10);
  assert.equal(new Set(legacyFormulaIds).size,10);
  assert.ok(legacyFormulaIds.every(id => !formulaById.has(id)));
  assert.ok(!formulaSeed.some(formula => /astachi/i.test(formula.name)));
  assert.equal(formulaById.get('supplier-athletic')?.pinyin,'Zhuang Yao Tang');
  assert.equal(formulaById.get('supplier-relax-resolve')?.pinyin,'Hua Yu Xiao Yao San');
});

test('all 16 PDF pages and category facts have bounded, per-product provenance with a document integrity hash', () => {
  assert.equal(supplierFormulaSources.length,10);
  assert.deepEqual([...new Set(supplierFormulaSources.flatMap(source => source.pages))].sort((a,b) => a-b),Array.from({length:16},(_,i) => i+1));
  for (const [id,name,pinyin,count,pages] of expected) {
    const source = sourceById.get(id)!;
    assert.equal(SupplierProfileSchema.safeParse(source).success,true,id);
    assert.equal(source.supplier,'China Nature');
    assert.equal(source.document,'rangejohan.pdf');
    assert.equal(source.documentSha256,'70c0eecf05c3d8f4e518e8d96f4574f445715cfa75a53a298e566b3db3782fe0');
    assert.equal(source.productName,name);
    assert.equal(source.formulaName,pinyin);
    assert.equal(source.ingredients.length,count,id);
    assert.deepEqual(source.pages,pages,id);
    for (const group of ['actions','traditionalPatterns','indications','explanation','temperature','cautions'] as const) {
      assert.ok(source[group].length > 0,`${id}:${group}`);
      for (const fact of source[group]) {
        assert.ok(fact.text.length > 0);
        assert.ok(fact.pages.length > 0);
        assert.ok(fact.pages.every(page => source.pages.includes(page)),`${id}:${group}`);
        assert.ok(['supplier','interpretation','unverified'].includes(fact.kind));
      }
    }
    for (const ingredient of source.ingredients) {
      assert.ok(ingredient.pinyin && ingredient.botanicalName);
      assert.ok(ingredient.pages.length > 0 && ingredient.pages.every(page => source.pages.includes(page)));
    }
  }
});

test('listed ingredient spellings and preparation are retained without silently resolving explanation conflicts', () => {
  const herbs = (id: string) => sourceById.get(id)!.ingredients.map(herb => `${herb.pinyin} - ${herb.botanicalName}`);
  assert.deepEqual(herbs('supplier-stomach'),[
    'Bai Zhu - atractylodes macrocephala rhizoma','Fu Ling - poria sclerotium','Sheng Jiang - zingiberis recens rhizoma',
    'Ban Xia (Jiang) - pinellia praeparatum (Jiang) rhizoma','Ren Shen - ginseng radix','Chen pi - citrus reticulata pericarpium',
    'Bai Dou Kou - amomum rotundus fructus','Gan Cao Zhi - glycyrrhizha praeparata radix','Mu Xiang - aucklandia radix',
  ]);
  assert.ok(!herbs('supplier-stomach').some(herb => herb.startsWith('Sha Ren -')));
  assert.ok(herbs('supplier-six').includes('Shu Di Huang - rehmania praeparata radix'));
  assert.ok(!herbs('supplier-six').some(herb => herb.startsWith('Sheng Di Huang -')));
  assert.ok(!herbs('supplier-slbz').some(herb => herb.startsWith('Bai Bian Dou -')));
  assert.ok(herbs('supplier-slbz').includes('Sha Ren - amomum villosum fructus'));
  assert.ok(herbs('supplier-four-marvel').includes('Yi Yi Ren - coicis praeparata semen'));
  assert.ok(herbs('supplier-auranthii').includes('Zhi Qiao (Chao) - citrus aurantium immaturus (dry-fried) fructus'));
  assert.equal(sourceById.get('supplier-athletic')!.pdfProductName,'Athelic herbs');
  assert.ok(herbs('supplier-athletic').includes('xuan niu xi - cyathula radix'));
  for (const source of supplierFormulaSources) {
    const formula = formulaById.get(source.id)!;
    assert.deepEqual(formula.ingredients,herbs(source.id));
    assert.deepEqual(formula.supplierProfile,source);
  }
});

test('exactly the three known content conflicts require verification and retain both cited alternatives', () => {
  assert.deepEqual(formulaSeed.filter(formula => formula.requiresVerification).map(formula => formula.id),['supplier-stomach','supplier-six','supplier-slbz']);
  assert.deepEqual(supplierFormulaSources.flatMap(source => source.verificationIssues.map(issue => [issue.code,issue.pages])),[
    ['stomach-bai-dou-kou-sha-ren',[5,6]],['six-shu-sheng-di-huang',[10,11]],['slbz-bai-bian-dou-not-listed',[13,14]],
  ]);
  assert.match(sourceById.get('supplier-stomach')!.verificationIssues[0].message,/Bai Dou Kou.*Sha Ren/);
  assert.match(sourceById.get('supplier-six')!.verificationIssues[0].message,/Shu Di Huang.*Sheng Di Huang/);
  assert.match(sourceById.get('supplier-slbz')!.verificationIssues[0].message,/Bai Bian Dou/);
  assert.ok(formulaSeed.every(formula => formula.verificationResolution === ''));
});

test('temperature, Chinese characters, quantities, extraction and product safety are not invented from classical names', () => {
  assert.ok(sourceById.get('supplier-athletic')!.temperature.some(fact => fact.kind === 'supplier' && /formula: warm/.test(fact.text)));
  assert.ok(sourceById.get('supplier-four-marvel')!.temperature.some(fact => fact.kind === 'supplier' && /formula: cold/.test(fact.text)));
  for (const source of supplierFormulaSources) {
    assert.equal(source.chineseName,null);
    for (const field of ['ingredientAmounts','productStrength','extractionRatio','finishedProductSpecification','batchIdentityAndQuality','contaminantTesting','completeSafetyAndInteractions','regulatoryStatus','chineseCharacters']) assert.ok(source.unverifiedFields.includes(field),`${source.id}:${field}`);
    if (!['supplier-athletic','supplier-four-marvel'].includes(source.id)) {
      assert.ok(source.unverifiedFields.includes('overallFormulaTemperature'));
      assert.ok(source.temperature.some(fact => fact.kind === 'unverified'));
    }
    const formula = formulaById.get(source.id)!;
    assert.equal(FormulaRecordSchema.safeParse(formula).success,true);
    assert.equal(validateFormulaRules(formula),true,source.id);
    assert.equal(formula.hanzi,'');
    assert.equal(formula.productId,null);
    assert.equal(formula.productUrl,null);
    assert.equal(formula.productIdentityVerified,false);
    assert.equal(formula.ingredientsVerified,false);
    assert.equal(formula.safetyVerified,false);
    assert.equal(formula.regulatoryVerified,false);
    assert.equal(productVerificationComplete(formula),false);
    assert.equal(formula.safetyEvidence,'');
    assert.equal(formula.regulatoryEvidence,'');
    assert.equal(formula.identityEvidence,'');
    assert.equal(formula.ingredientEvidence,'');
  }
});

test('supplier disease lists remain explicit private evidence rather than matching rules or public theory claims', () => {
  const source = sourceById.get('supplier-relax-resolve')!;
  assert.ok(source.indications.some(fact => fact.text === 'Coronary heart disease (CHD)' && fact.kind === 'supplier' && fact.pages.includes(8)));
  assert.ok(sourceById.get('supplier-six')!.indications.some(fact => fact.text === 'Multiple sclerosis (MS)' && fact.pages.includes(10)));
  const publicTheory = formulaSeed.map(formula => [formula.theoryExplanation,formula.scopeLimitation,formula.swedishName].join(' ')).join(' ');
  assert.doesNotMatch(publicTheory,/coronary|multiple sclerosis|diabetes|chemotherapy|infertility/i);
  for (const formula of formulaSeed) for (const item of [...formula.supportingRules,...formula.opposingRules,...formula.contraindicationRules]) {
    assert.ok(item.values.every(value => !/[ ()]/.test(value)),'rules must use the curated answer vocabulary');
  }
});

test('known supplier contraindications remain independent vetoes, not subtractable score penalties', () => {
  for (const id of ['supplier-tonic','supplier-womens','supplier-relax-resolve']) {
    const formula = formulaById.get(id)!;
    assert.ok(formula.requiredQuestionIds.includes('currentInfection'));
    assert.ok(formula.contraindicationRules.some(item => item.questionId === 'currentInfection' && item.values.includes('yes')));
    assert.ok(formula.requiredSafetyRules.some(item => item.questionId === 'currentInfection' && item.values.includes('no')));
  }
  assert.ok(formulaById.get('supplier-slbz')!.contraindicationRules.some(item => item.questionId === 'constipation' && item.values.includes('yes')));
  assert.ok(formulaById.get('supplier-coptis-scute')!.contraindicationRules.some(item => item.questionId === 'heatTiming' && item.values.includes('evening_night')));
  assert.deepEqual(formulaById.get('supplier-relax-resolve')!.requiredPatternIds,['liverQiStasisHeat','liverBloodDeficiency']);
  assert.ok(formulaById.get('supplier-coptis-scute')!.safetyNotes.some(note => /alkaloid/.test(note) && /interaktion/.test(note)));
});
