"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAnamnesAnalysisModeAction } from "@/lib/anamnes/admin-actions";

export function AnamnesAnalysisSettings({ mode, aiConfigured }: { mode: "rules" | "ai"; aiConfigured: boolean }) {
  const [state, action, pending] = useActionState(saveAnamnesAnalysisModeAction, {});
  const [selected, setSelected] = useState(mode);
  const router = useRouter();
  useEffect(() => { setSelected(mode); }, [mode]);
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <section className="panel anamnes-admin-full" aria-labelledby="anamnes-analysis-settings-title">
    <h2 id="anamnes-analysis-settings-title">Välj analysmetod</h2>
    <p>Styr vilken anamnes besökarna får använda. Valet sparas direkt och kräver ingen ny deployment.</p>
    <form action={action} className="anamnes-admin-editor">
      <fieldset disabled={pending} className="anamnes-analysis-choice-fieldset"><legend>Analysmetod för nya anamneser</legend><div className="anamnes-analysis-choices">
        <label className={`anamnes-analysis-choice${selected === "rules" ? " is-selected" : ""}`}><input type="radio" name="analysisMode" value="rules" checked={selected === "rules"} onChange={() => setSelected("rules")} /><span><strong>Poängbaserad anamnes</strong><span>Svaren jämförs med fasta mönsterregler i webbläsaren. Inga svar skickas till en AI-leverantör.</span></span></label>
        <label className={`anamnes-analysis-choice${selected === "ai" ? " is-selected" : ""}`}><input type="radio" name="analysisMode" value="ai" checked={selected === "ai"} onChange={() => setSelected("ai")} /><span><strong>AI-assisterad anamnes</strong><span>Besökaren beskriver sina besvär med egna ord. AI väljer relevanta frågor stegvis. Poängmodellen kontrollerar resultatet och används som reserv.</span></span></label>
      </div></fieldset>
      {selected === "ai" && <p className={aiConfigured ? "muted" : "notice"}>{aiConfigured ? "AI är tekniskt konfigurerad. Besökaren måste fortfarande välja att dela sin beskrivning och sina svar med AI-leverantören. Utan samtycke används poänganalysen." : "Du kan spara AI som önskat läge, men AI är ännu inte färdigkonfigurerad. Tills inställningarna nedan är klara får besökaren poängbaserad analys."}</p>}
      <p className="muted">Säkerhetsspärrar och formelbegränsningar gäller i båda lägena. Befintliga rapporter ändras inte. Ett AI-anrop som redan har skickats kan inte återkallas genom att byta läge.</p>
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}{state.success && <p className="notice notice-success" role="status">{state.success}</p>}
      <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Sparar analysmetod…" : "Spara analysmetod"}</button>
    </form>
  </section>;
}
