import type { Metadata } from "next";
import { FivePhasesSelfTest } from "@/components/five-phases/self-test";

export const metadata: Metadata = {
  title: "Fem Element Test – Upptäck din TCM-konstitution",
  description:
    "Gör ett självtest inspirerat av traditionell kinesisk medicins fem faser och se om din konstitution främst motsvarar Trä, Eld, Jord, Metall eller Vatten.",
};

export default function SelfTestPage() {
  return <FivePhasesSelfTest />;
}
