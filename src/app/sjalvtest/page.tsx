import { FivePhasesSelfTest } from "@/components/five-phases/self-test";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Fem Element Test – Upptäck din TCM-konstitution",
  description:
    "Gör ett självtest inspirerat av traditionell kinesisk medicins fem faser och se om din konstitution främst motsvarar Trä, Eld, Jord, Metall eller Vatten.",
  path: "/sjalvtest",
});

export default function SelfTestPage() {
  return <FivePhasesSelfTest />;
}
