"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Clipboard, Leaf, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import {
  analyseIntake, focusOptions, initialIntake, makeSummary, symptomGroups, symptomLabel,
  type Choice, type Intake, type Symptom,
} from "@/lib/tcm-anamnes";
import styles from "./tcm-anamnes.module.css";

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const steps = ["Säkerhet", "Huvudområde", "Symtom", "Detaljer", "Sammanfattning"];

export default function TcmAnamnes() {
  const [step, setStep] = useState<Step>(0);
  const [intake, setIntake] = useState<Intake>(() => ({ ...initialIntake, symptoms: [] }));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const previousStep = useRef(step);
  const analysis = useMemo(() => analyseIntake(intake), [intake]);
  const summary = useMemo(() => makeSummary(intake), [intake]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [step]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    setIntake(previous => ({ ...previous, [key]: value }));
    setError("");
    setCopied(false);
  }

  function go(nextStep: Step) {
    setStep(nextStep);
    setError("");
    setCopied(false);
  }

  function next() {
    if (intake.emergency === "yes") { go(5); return; }
    if (step === 1 && (!intake.adult || !intake.pregnantOrNursing || !intake.emergency)) {
      setError("Besvara de tre säkerhetsfrågorna innan du fortsätter."); return;
    }
    if (step === 2 && !intake.focus) { setError("Välj det huvudområde du vill ta upp."); return; }
    if (step === 3 && intake.symptoms.length === 0) { setError("Markera minst ett symtom, eller gå tillbaka och välj ett annat huvudområde."); return; }
    if (step === 4 && analysis.status !== "ready") {
      setError("Några svar saknas. Gå tillbaka och kontrollera säkerhetsfrågorna, huvudområdet och symtomen."); return;
    }
    if (step > 0 && step < 5) go((step + 1) as Step);
  }

  function toggleSymptom(symptom: Symptom) {
    update("symptoms", intake.symptoms.includes(symptom)
      ? intake.symptoms.filter(value => value !== symptom)
      : [...intake.symptoms, symptom]);
  }

  function reset() {
    setIntake({ ...initialIntake, symptoms: [] });
    go(0);
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setError("");
    } catch {
      setCopied(false);
      setError("Webbläsaren tillät inte kopiering. Markera och kopiera texten i sammanfattningsfältet nedan i stället.");
    }
  }

  function navigation(label: string): ReactNode {
    return <div className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={() => go((step - 1) as Step)}><ArrowLeft size={16} aria-hidden="true" />Tillbaka</button>
      <button type="button" className={styles.primary} onClick={next}>{label}<ArrowRight size={16} aria-hidden="true" /></button>
    </div>;
  }

  function heading(text: string) {
    return <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>{text}</h2>;
  }

  return <div className={styles.shell}>
    <div className={styles.topbar}><span><Leaf size={18} aria-hidden="true" /> Tibb.nu · Förberedande anamnes</span><span><LockKeyhole size={14} aria-hidden="true" /> Svaren stannar här</span></div>
    <div className={styles.body}>
      {step > 0 && analysis.status !== "emergency" && <ol className={styles.progress} aria-label="Anamnesens steg">
        {steps.map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step >= index + 1 ? styles.reached : ""}>
          <span className={styles.stepNumber}>{step > index + 1 ? <Check size={15} aria-label="Genomfört" /> : index + 1}</span><span>{label}</span>
        </li>)}
      </ol>}

      {step === 0 && <section>
        {heading("En tydligare bild inför ditt samtal")}
        <p className={styles.lead}>Samla dina symtom och observationer inför en individuell rådgivning. Du får en sammanfattning och preliminära mönster enligt traditionell kinesisk medicin.</p>
        <div className={styles.features}>
          <div><span className={styles.featureIcon}><Check size={21} aria-hidden="true" /></span><strong>Fyra korta steg</strong><p>Tar ungefär 3–5 minuter.</p></div>
          <div><span className={styles.featureIcon}><LockKeyhole size={21} aria-hidden="true" /></span><strong>Privat i webbläsaren</strong><p>Ingen inloggning eller inskickning.</p></div>
          <div><span className={styles.featureIcon}><ShieldCheck size={21} aria-hidden="true" /></span><strong>Inför en bedömning</strong><p>Formelreferenser att diskutera.</p></div>
        </div>
        <div className={styles.notice}><strong>Ett samtalsunderlag</strong><p>Frågorna och poängmodellen är förenklade och inte kliniskt validerade. Resultatet avgör inte vilken örtformula som passar dig och ersätter inte vård eller individuell bedömning. Örter kan påverka läkemedel och behöver bedömas utifrån din hälsa.</p></div>
        <p className={styles.privacy}>Dina svar skickas inte till Tibb.nu och sparas inte i en databas eller i webbläsarens lagring. Ladda om sidan eller välj ”Rensa svar och börja om” för att ta bort dem. Du väljer själv om du vill kopiera sammanfattningen.</p>
        <button type="button" className={styles.primary} onClick={() => go(1)}>Starta anamnesen<ArrowRight size={17} aria-hidden="true" /></button>
      </section>}

      {step === 1 && <section>
        {heading("Först några säkerhetsfrågor")}
        <p className={styles.lead}>Besvara de tre frågorna och markera sådant som rådgivaren behöver känna till.</p>
        <RadioQuestion title="Är du 18 år eller äldre?" name="adult" value={intake.adult} options={[["yes", "Ja"], ["no", "Nej"]]} onChange={value => update("adult", value as Choice)} required />
        <RadioQuestion title="Är du gravid eller ammar?" name="pregnantOrNursing" value={intake.pregnantOrNursing} options={[["no", "Nej"], ["yes", "Ja"]]} onChange={value => update("pregnantOrNursing", value as Choice)} required />
        <RadioQuestion title="Har du just nu bröstsmärta, svår andnöd, plötsliga talsvårigheter eller förlamningar, plötslig mycket svår huvudvärk eller annan akut allvarlig sjukdomskänsla?" name="emergency" value={intake.emergency} options={[["no", "Nej"], ["yes", "Ja"]]} onChange={value => {
          update("emergency", value as Choice);
          if (value === "yes") go(5);
        }} required />
        <fieldset className={styles.fieldset}><legend>Andra omständigheter <span className={styles.optional}>(markera det som gäller)</span></legend>
          <div className={styles.stack}>
            <Checkbox text="Jag använder läkemedel eller andra kosttillskott" checked={intake.meds} onChange={value => update("meds", value)} />
            <Checkbox text="Jag har en långvarig sjukdom eller får medicinsk behandling" checked={intake.chronic} onChange={value => update("chronic", value)} />
            <Checkbox text="Jag har allergier eller har reagerat på örtpreparat" checked={intake.allergies} onChange={value => update("allergies", value)} />
          </div>
        </fieldset>
        <p className={styles.warning}>Vid akuta allvarliga symtom: sök vård omedelbart och ring 112 vid nödläge. Avbryt inte ordinerad medicinering.</p>
        {navigation("Nästa: huvudområde")}
      </section>}

      {step === 2 && <section>
        {heading("Vad vill du främst ta upp?")}
        <p className={styles.lead}>Välj ett huvudområde. I nästa steg kan du markera symtom från flera områden.</p>
        <fieldset className={styles.fieldset}><legend className={styles.srOnly}>Välj ett huvudområde</legend>
          <div className={styles.focusGrid}>{focusOptions.map(option => <label className={`${styles.option} ${intake.focus === option.id ? styles.selected : ""}`} key={option.id}>
            <input type="radio" name="focus" value={option.id} checked={intake.focus === option.id} onChange={() => update("focus", option.id)} /><span>{option.label}</span>
          </label>)}</div>
        </fieldset>
        {navigation("Nästa: symtom")}
      </section>}

      {step === 3 && <section>
        {heading("Vilka tecken känner du igen?")}
        <p className={styles.lead}>Markera sådant som tydligt stämmer in på hur du har mått den senaste tiden. Ett fåtal svar kan ge för lite underlag för en mönsterhypotes.</p>
        {symptomGroups.map(group => <fieldset className={styles.symptomGroup} key={group.title}><legend>{group.title}</legend>
          <div className={styles.symptomGrid}>{group.items.map(item => <Checkbox text={item.label} key={item.id} checked={intake.symptoms.includes(item.id)} onChange={() => toggleSymptom(item.id)} />)}</div>
        </fieldset>)}
        <p className={styles.selectedCount} role="status">{intake.symptoms.length} {intake.symptoms.length === 1 ? "symtom markerat" : "symtom markerade"}</p>
        {navigation("Nästa: detaljer")}
      </section>}

      {step === 4 && <section>
        {heading("Några kompletterande observationer")}
        <p className={styles.lead}>De här frågorna är frivilliga. Välj ”Vet inte” om du är osäker. Observationerna kan inte ensamma fastställa ett mönster.</p>
        <RadioQuestion title="Hur upplever du oftast din kroppstemperatur?" name="heat" value={intake.heat} options={[["cold", "Ofta frusen"], ["warm", "Ofta varm"], ["neutral", "Varken eller"], ["unsure", "Vet inte"]]} onChange={value => update("heat", value as Intake["heat"])} />
        <RadioQuestion title="Vilken beskrivning liknar din tunga mest?" name="tongue" value={intake.tongue} options={[["pale", "Blek"], ["red", "Röd"], ["greasy", "Tjock eller kladdig beläggning"], ["normal", "Ingen tydlig avvikelse"], ["unsure", "Vet inte"]]} onChange={value => update("tongue", value as Intake["tongue"])} />
        <RadioQuestion title="Hur länge har besvären funnits?" name="duration" value={intake.duration} options={[["days", "Dagar"], ["weeks", "Veckor"], ["months", "Månader"], ["years", "År"], ["unsure", "Vet inte"]]} onChange={value => update("duration", value as Intake["duration"])} />
        {navigation("Visa sammanfattning")}
      </section>}

      {step === 5 && <section>
        {analysis.status === "emergency" ? <>
          {heading("Avbryt formuläret och sök vård")}
          <div className={styles.alert} role="alert"><strong>De symtom du markerat kan kräva snabb medicinsk bedömning.</strong><p>Ring 112 vid ett akut nödläge. Formuläret kan inte bedöma orsaken eller hur allvarligt det är.</p></div>
          <div className={styles.actions}><a href="tel:112" className={styles.primary}>Ring 112</a><button type="button" className={styles.secondary} onClick={reset}>Rensa svar och börja om</button></div>
        </> : analysis.status !== "ready" ? <>
          {heading("Svaren behöver kompletteras")}
          <p className={styles.notice}>Besvara säkerhetsfrågorna och välj huvudområde och symtom innan du visar en sammanfattning.</p>
          <button type="button" className={styles.secondary} onClick={() => go(1)}>Till säkerhetsfrågorna</button>
        </> : <>
          {heading("Ditt underlag inför rådgivning")}
          <p className={styles.lead}>Här ser du preliminära TCM-mönster utifrån dina svar. En individuell bedömning behövs för att avgöra vad besvären beror på och om örter är lämpliga.</p>
          {analysis.higherRisk && <div className={styles.warning}><strong>Individuell säkerhetsbedömning behövs.</strong><p>Du har markerat en omständighet som kan påverka användning av örter. Därför visas inga formelreferenser. Ta upp uppgifterna med vården och din rådgivare.</p></div>}
          {analysis.clinicalCaution && <div className={styles.alert}><strong>Symtom att ta upp med vården.</strong><p>Du har markerat exempelvis hjärtklappning, yrsel, en varm eller svullen led eller urinvägsbesvär. Kontakta vården för bedömning. Ring 1177 om du behöver hjälp att avgöra var du ska söka vård.</p></div>}
          {analysis.matches.length > 0 ? <div className={styles.matchList}>{analysis.matches.map((match, index) => <article className={styles.matchCard} key={match.id}>
            <div className={styles.matchNumber}>{index + 1}</div>
            <div><p className={styles.matchLabel}>{index === 0 ? "Mönsterhypotes att undersöka" : "Alternativ mönsterhypotes"}</p><h3>{match.name}</h3><p className={styles.hanzi} lang="zh">{match.hanzi}</p><p>{match.context}</p>
              <ul className={styles.tags} aria-label="Symtom som ingår i matchningen">{match.matched.map(symptom => <li key={symptom}>{symptomLabel(symptom)}</li>)}</ul>
              <p className={styles.differentials}><strong>Att undersöka vidare:</strong> {match.differentials}</p>
              {analysis.canShowFormulaReferences && <div className={styles.formula}><span>Referens i klassisk TCM-litteratur</span><strong>{match.formula}</strong><p>För jämförelse vid individuell rådgivning. Det är inte en rekommendation att köpa eller ta preparatet. Sammansättning, kontraindikationer och läkemedelsinteraktioner behöver granskas separat.</p></div>}
            </div>
          </article>)}</div> : <div className={styles.notice}><strong>Ingen tillräckligt tydlig mönstermatchning.</strong><p>Svaren ger för lite underlag eller överlappar flera mönster. Det betyder inte att dina symtom saknar betydelse. Ta med sammanfattningen till en individuell bedömning.</p></div>}
          <div className={styles.summaryPanel}>
            <h3>Ta med dina svar</h3><p>Du väljer själv om du vill kopiera sammanfattningen. Tibb.nu har inte tagit emot svaren. Bokningsknappen skickar inte med dem.</p>
            <label htmlFor="anamnes-summary" className={styles.summaryLabel}>Din sammanfattning</label><textarea id="anamnes-summary" readOnly rows={12} value={summary} className={styles.summaryText} spellCheck={false} />
            <div className={styles.actions}><button type="button" className={styles.secondary} onClick={copySummary}><Clipboard size={16} aria-hidden="true" />{copied ? "Kopierad" : "Kopiera sammanfattning"}</button><Link href="/boka" className={styles.primary} prefetch={false}>Boka rådgivning<ArrowRight size={16} aria-hidden="true" /></Link></div>
            {copied && <p role="status" className={styles.copyStatus}>Sammanfattningen kopierades. Den innehåller hälsouppgifter; välj själv hur du delar den.</p>}
          </div>
          <div className={styles.editActions}><button type="button" onClick={() => go(1)}>Ändra säkerhetsuppgifter</button><button type="button" onClick={() => go(2)}>Ändra huvudområde</button><button type="button" onClick={() => go(3)}>Ändra symtom</button><button type="button" onClick={() => go(4)}>Ändra detaljer</button><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Rensa svar och börja om</button></div>
        </>}
      </section>}

      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
      {step > 0 && step < 5 && <div className={styles.editActions}><button type="button" onClick={reset}><RotateCcw size={14} aria-hidden="true" />Rensa svar och börja om</button></div>}
      <div className={styles.sources}><span>Om örter och säkerhet:</span><a href="https://www.1177.se/undersokning-behandling/fler-behandlingar/alternativa-behandlingar/vaxtbaserade-lakemedel-och-naturlakemedel/" target="_blank" rel="noopener noreferrer">1177 – växtbaserade läkemedel ↗</a><a href="https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know" target="_blank" rel="noopener noreferrer">NCCIH – traditionell kinesisk medicin ↗</a></div>
    </div>
  </div>;
}

function RadioQuestion({ title, name, value, options, onChange, required = false }: {
  title: string; name: string; value: string; options: readonly (readonly [string, string])[];
  onChange: (value: string) => void; required?: boolean;
}) {
  return <fieldset className={styles.fieldset}><legend>{title}{required && <span className={styles.required}> (obligatorisk)</span>}</legend>
    <div className={styles.radioGrid}>{options.map(([id, label]) => <label className={`${styles.option} ${value === id ? styles.selected : ""}`} key={id}>
      <input type="radio" name={name} value={id} checked={value === id} required={required} onChange={() => onChange(id)} /><span>{label}</span>
    </label>)}</div>
  </fieldset>;
}

function Checkbox({ text, checked, onChange }: { text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={`${styles.option} ${styles.checkbox} ${checked ? styles.selected : ""}`}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{text}</span></label>;
}
