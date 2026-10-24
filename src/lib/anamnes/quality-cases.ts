import { QualityCaseSchema, type QualityCase } from './quality-contract';
import { type AnswerMap, type PatternId } from './types';
import { patternById } from './patterns';
import { patternComponents } from './assessment';

// Entirely fictional engineering scenarios, not clinical records or expert
// diagnoses. Construction targets are kept separate from owner-approved labels.
const safety:AnswerMap={adult:'yes',pregnancy:'no',medication:'no',chronicDisease:'no',liverKidney:'no',allergy:'no',emergency:'no',clinicalRedFlags:'no'};
const context:AnswerMap={focus:'other',duration:'months',onset:'gradual',trend:'stable',temperature:'neutral',thirst:'normal',sweating:'normal',energy:'normal',appetite:'normal',stool:'normal',sleep:'normal',emotion:'calm',pain:'no'};
const profiles:{target:PatternId;narrative:string;answers:AnswerMap}[]=[
  {target:'spleenQiDeficiency',narrative:'Jag blir trött efter maten, äter mindre och har lös avföring.',answers:{focus:'digestion',energy:'after_food',appetite:'low',stool:'loose',afterMealBloat:'yes',weakVoice:'yes',exertion:'tired'}},
  {target:'liverQiStagnation',narrative:'Jag känner mig spänd och lättirriterad. Rörelse och avslappning lindrar.',answers:{focus:'stress',emotion:'irritable',ribTension:'yes',stressRelief:'yes',irritability:'yes',pain:'yes',painCharacter:'distending',painMovement:'better'}},
  {target:'liverInvadesSpleen',narrative:'Magen svullnar och avföringen växlar. Det blir mer besvär under stress.',answers:{focus:'digestion',stressDigestion:'yes',ribTension:'yes',afterMealBloat:'yes',stool:'alternating',emotion:'worry',abdominalPain:'distending'}},
  {target:'spleenDampness',narrative:'Jag blir tung och trött efter mat och har kladdig lös avföring.',answers:{focus:'digestion',energy:'after_food',appetite:'low',stool:'sticky',heaviness:'yes',afterMealBloat:'yes',tongueCoating:'white_greasy'}},
  {target:'stomachQiStagnation',narrative:'Jag är uppblåst och mår illa. Rapningar kan minska trycket.',answers:{focus:'digestion',afterMealBloat:'yes',nausea:'yes',reflux:'belching',abdominalPain:'distending',bowelRelief:'yes'}},
  {target:'foodStagnation',narrative:'Efter stora måltider får jag sura uppstötningar och fullhet.',answers:{focus:'digestion',onset:'after_food',foodTrigger:'yes',reflux:'sour',afterMealBloat:'yes',stoolOdor:'yes',nausea:'yes'}},
  {target:'liverFire',narrative:'Jag är varm och irriterad, mycket törstig och tycker tungan är röd.',answers:{focus:'temperature',temperature:'hot',thirst:'strong_cold',irritability:'yes',emotion:'irritable',tongueColor:'red',tongueCoating:'yellow_dry',constipation:'yes'}},
  {target:'phlegmHeat',narrative:'Jag har slemmig hosta med gult slem och känner mig varm.',answers:{focus:'other',cough:'productive',phlegm:'yellow',temperature:'hot',tongueCoating:'yellow_greasy',heaviness:'yes',thirst:'strong_cold'}},
  {target:'bloodStasis',narrative:'Värken sitter på samma ställe och känns stickande.',answers:{focus:'pain',pain:'yes',painLocation:'muscles',painCharacter:'stabbing',tongueColor:'purple',menstruation:'yes',menstrualPain:'clots_pain',jointWarmth:'no',painWarmth:'neutral',weatherPain:'no'}},
  {target:'qiSinking',narrative:'Jag är trött och svag och har en nedåtdragande känsla.',answers:{focus:'energy',energy:'low',weakVoice:'yes',sinking:'yes',stool:'loose',appetite:'low',exertion:'tired'}},
  {target:'liverBloodDeficiency',narrative:'Jag har torra ögon, sköra naglar och känner mig blek och yr.',answers:{focus:'energy',pallor:'yes',dizziness:'yes',dryEyes:'yes',hairNails:'yes',tongueColor:'pale',menstruation:'yes',menstrualFlow:'scant'}},
  {target:'heartBloodDeficiency',narrative:'Jag sover lätt med många drömmar och är blek och glömsk.',answers:{focus:'sleep',sleep:'difficulty',pallor:'yes',dizziness:'yes',dreams:'yes',mentalFatigue:'yes',tongueColor:'pale',nightWaking:'yes'}},
  {target:'qiBloodDeficiency',narrative:'Jag är utmattad, blek och yr. Rösten är svag.',answers:{focus:'energy',energy:'low',pallor:'yes',dizziness:'yes',weakVoice:'yes',tongueColor:'pale',exertion:'tired'}},
  {target:'lungWeiQiDeficiency',narrative:'Jag blir ofta förkyld, svettas lätt och besväras av drag.',answers:{focus:'immunity',frequentInfections:'yes',windSensitivity:'yes',weakVoice:'yes',sweating:'spontaneous',energy:'low',currentInfection:'no'}},
  {target:'kidneyYinDeficiency',narrative:'Jag är torr i munnen, varm om nätterna och svag i ländryggen.',answers:{focus:'temperature',dryMouth:'yes',nightSweats:'yes',hotPalms:'yes',backWeakness:'yes',tinnitus:'yes',tongueCoating:'scant',heatTiming:'evening_night'}},
  {target:'yangDeficiency',narrative:'Jag fryser och har låg energi, värme brukar hjälpa.',answers:{focus:'energy',temperature:'cold',energy:'low',painWarmth:'better',stool:'loose',backWeakness:'yes',exertion:'tired',urination:'frequent_clear'}},
  {target:'windColdDampBi',narrative:'Lederna värker i kallt fuktigt väder och värme lindrar.',answers:{focus:'pain',pain:'yes',painLocation:'joints',weatherPain:'yes',painWarmth:'better',stiffness:'yes',jointWarmth:'no',painCharacter:'dull',painMovement:'better',temperature:'cold'}},
  {target:'dampHeatLower',narrative:'Benen känns tunga och svullna och jag är varm.',answers:{focus:'pain',pain:'yes',painLocation:'lower_limbs',heaviness:'yes',temperature:'hot',tongueCoating:'yellow_greasy',urination:'scant_dark',edema:'yes',jointWarmth:'no',painCharacter:'dull'}},
  {target:'dryness',narrative:'Jag är torr i munnen och huden och hostar torrt.',answers:{focus:'temperature',dryMouth:'yes',dryEyes:'yes',cough:'dry',tongueMoisture:'dry',stool:'dry',thirst:'small_sips'}},
  {target:'exteriorWindHeat',narrative:'Sedan några dagar hostar jag och känner mig varm och känslig för drag.',answers:{focus:'immunity',duration:'days',onset:'after_illness',temperature:'hot',windSensitivity:'yes',cough:'dry',thirst:'strong_cold',currentInfection:'yes'}},
  {target:'stomachYinDeficiency',narrative:'Munnen är torr, jag är småtörstig och magen känns obekväm.',answers:{focus:'digestion',dryMouth:'yes',thirst:'small_sips',tongueCoating:'scant',tongueCracks:'yes',appetite:'low',stool:'dry',tongueMoisture:'dry'}},
  {target:'heartSpleenDeficiency',narrative:'Jag grubblar och sover dåligt, äter lite och är blek och trött.',answers:{focus:'sleep',sleep:'difficulty',rumination:'yes',energy:'low',appetite:'low',stool:'loose',pallor:'yes',mentalFatigue:'yes',tongueColor:'pale'}},
  {target:'liverSpleenBloodDeficiency',narrative:'Stress påverkar magen. Jag är blek, trött och spänd.',answers:{focus:'digestion',stressDigestion:'yes',ribTension:'yes',stool:'loose',appetite:'low',energy:'low',pallor:'yes',tongueColor:'pale',dizziness:'yes'}},
  {target:'chronicBiDeficiency',narrative:'Sedan flera år har jag stel värk och svag rygg, värst i kyla.',answers:{focus:'pain',duration:'years',pain:'yes',painLocation:'back_knees',backWeakness:'yes',weatherPain:'yes',painWarmth:'better',stiffness:'yes',energy:'low',jointWarmth:'no',painCharacter:'dull',painMovement:'better'}},
  {target:'liverBloodShenDisturbance',narrative:'Jag har svårt att somna, är torr i ögonen och känner mig blek.',answers:{focus:'sleep',sleep:'difficulty',sleepOnset:'yes',dreams:'yes',pallor:'yes',dryEyes:'yes',tongueColor:'pale',dizziness:'yes'}},
  {target:'kidneyYangColdDampBi',narrative:'Jag fryser och har svaghet i ländrygg och knän med väderkänslig värk.',answers:{focus:'pain',pain:'yes',painLocation:'back_knees',temperature:'cold',backWeakness:'yes',weatherPain:'yes',painWarmth:'better',stiffness:'yes',energy:'low',jointWarmth:'no',painCharacter:'dull',painMovement:'better'}},
  {target:'excessFireToxin',narrative:'Jag känner stark ihållande värme, är mycket törstig och förstoppad.',answers:{focus:'temperature',temperature:'hot',heatTiming:'persistent_strong',thirst:'strong_cold',tongueCoating:'yellow_dry',tongueColor:'red',constipation:'yes',irritability:'yes',urination:'scant_dark'}},
  {target:'qiBloodYangDeficiency',narrative:'Jag fryser, blir lätt uttröttad och känner mig blek och yr.',answers:{focus:'energy',temperature:'cold',energy:'low',weakVoice:'yes',exertion:'tired',pallor:'yes',tongueColor:'pale',dizziness:'yes'}},
  {target:'spleenQiColdDampStagnation',narrative:'Jag är trött efter mat och frusen, med lös avföring, tyngd och uppblåsthet.',answers:{focus:'digestion',temperature:'cold',energy:'after_food',appetite:'low',stool:'loose',heaviness:'yes',afterMealBloat:'yes',tongueCoating:'white_greasy',reflux:'belching',abdominalPain:'distending',nausea:'yes'}},
  {target:'liverQiStasisHeat',narrative:'Jag är varm och spänd, med återkommande fixerad stickande värk.',answers:{focus:'stress',ribTension:'yes',stressDigestion:'yes',stressRelief:'yes',irritability:'yes',emotion:'irritable',pain:'yes',painCharacter:'stabbing',tongueColor:'purple',temperature:'hot'}},
];
const cases:QualityCase[]=profiles.map((profile,index)=>({id:`case-${String(index+1).padStart(3,'0')}`,category:patternComponents(patternById.get(profile.target)!).length>1?'compound':'single',narrative:profile.narrative,
  answers:{...safety,...context,...profile.answers},engineeringTarget:profile.target,constructionNote:'Tekniskt konstruerat exempel utifrån den befintliga frågebanken. Konstruktionsmålet är inte ett facit och mönstret måste bedömas självständigt.'}));
const challenges:{profile:number;category:QualityCase['category'];changes:AnswerMap;narrative:string;minimal?:boolean}[]=[
  {profile:3,category:'neighbor',changes:{temperature:'cold',reflux:'none',abdominalPain:'none'},narrative:'Kyla och tyngd men inga rapningar eller bukspänning.'},
  {profile:28,category:'neighbor',changes:{temperature:'neutral'},narrative:'Tyngd och matsmältningsbesvär, men ingen tydlig frusenhet.'},
  {profile:12,category:'neighbor',changes:{temperature:'cold'},narrative:'Blekhet, låg energi och dessutom frusenhet.'},
  {profile:27,category:'neighbor',changes:{pallor:'no',tongueColor:'normal',dizziness:'no'},narrative:'Trötthet och frusenhet utan blekhet eller yrsel.'},
  {profile:25,category:'neighbor',changes:{backWeakness:'no'},narrative:'Väderkänslig värk och kyla, men ingen ryggsvaghet.'},
  {profile:14,category:'neighbor',changes:{backWeakness:'no',tinnitus:'no'},narrative:'Torrhet och nattvärme utan ryggsvaghet eller öronsus.'},
  {profile:1,category:'neighbor',changes:{temperature:'neutral',tongueColor:'normal'},narrative:'Spänning och irritation utan hette- eller stastecken.'},
  {profile:26,category:'neighbor',changes:{heatTiming:'evening_night',tongueCoating:'scant',nightSweats:'yes'},narrative:'Värmen är främst på natten och jag svettas då.'},
  {profile:28,category:'conflict',changes:{temperature:'mixed',tongueColor:'pale',thirst:'strong_cold'},narrative:'Jag beskriver både kyla och stark värme och är osäker på tidsförloppet.'},
  {profile:16,category:'conflict',changes:{pain:'no',painCharacter:'stabbing'},narrative:'Jag har angett ingen värk men samtidigt stickande smärta.'},
  {profile:6,category:'conflict',changes:{tongueColor:'pale'},narrative:'Jag känner stark värme och törst men tycker tungan är blek.'},
  {profile:8,category:'conflict',changes:{painLocation:'none'},narrative:'Jag valde ingen smärtplats men beskrev en stickande karaktär.'},
  {profile:0,category:'incomplete',changes:{focus:'energy',energy:'low'},minimal:true,narrative:'Jag är trött, men har svårt att beskriva något mer.'},
  {profile:0,category:'incomplete',changes:{focus:'digestion',appetite:'unknown',stool:'prefer_not'},minimal:true,narrative:'Magen besvärar mig, men jag vill inte lämna fler uppgifter.'},
  {profile:14,category:'incomplete',changes:{backWeakness:'unknown',tinnitus:'prefer_not',tongueCoating:'unknown'},narrative:'Jag vet inte hur ryggen eller tungan ska beskrivas.'},
  {profile:28,category:'changes',changes:{temperature:'hot',tongueCoating:'yellow_greasy'},narrative:'Först tänkte jag på trötthet och fullhet, men är också tydligt varm.'},
  {profile:1,category:'changes',changes:{painCharacter:'stabbing',tongueColor:'purple',temperature:'hot'},narrative:'Utöver spänning finns fixerad stickande värk och värme.'},
  {profile:0,category:'abstain',changes:{focus:'other'},minimal:true,narrative:'Jag har inga tydliga besvär att beskriva.'},
  {profile:0,category:'abstain',changes:{focus:'other',temperature:'unknown',energy:'unknown',sleep:'prefer_not'},minimal:true,narrative:'Jag vet inte hur jag mår och vill avstå från flera frågor.'},
  {profile:0,category:'abstain',changes:{focus:'other',energy:'normal',stool:'normal',sleep:'normal',temperature:'neutral'},minimal:true,narrative:'Jag upplever normal energi, sömn och matsmältning.'},
];
for(const [index,challenge] of challenges.entries())cases.push({id:`case-${String(index+31).padStart(3,'0')}`,category:challenge.category,narrative:challenge.narrative,
  answers:{...safety,...(challenge.minimal?{focus:'other',duration:'months',onset:'gradual',trend:'stable'}:context),...(challenge.minimal?{}:profiles[challenge.profile].answers),...challenge.changes},
  engineeringTarget:null,constructionNote:'Fiktivt gränsfall för regression: ofullständiga, förändrade eller motstridiga uppgifter. Ingen expertförväntning har lagts till automatiskt.'});
export const qualityCases=cases.map(item=>QualityCaseSchema.parse(item));
