import { FivePhasesSelfTest } from "@/components/five-phases/self-test";
import { NavigationLink } from "@/components/navigation-link";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Fem Element Test – Upptäck din TCM-konstitution",
  description:
    "Gör ett självtest inspirerat av traditionell kinesisk medicins fem faser och se om din konstitution främst motsvarar Trä, Eld, Jord, Metall eller Vatten.",
  path: "/sjalvtest",
});

export default function SelfTestPage() {
  return (
    <>
      <aside
        className="container panel"
        aria-label="Anamnes inför rådgivning"
        style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}
      >
        <p style={{ flex: "1 1 300px", margin: 0 }}>
          Vill du förbereda ett personligt samtal? Samla dina besvär och vanor i vår anamnes.
        </p>
        <NavigationLink href="/anamnes" className="button button-secondary" intentOnly>
          Anamnes inför rådgivning
        </NavigationLink>
      </aside>
      <FivePhasesSelfTest />
    </>
  );
}
