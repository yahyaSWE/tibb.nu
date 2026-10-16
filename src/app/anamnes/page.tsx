import TcmAnamnes from "@/components/anamnes/tcm-anamnes";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Anamnes" };

export default function AnamnesPage() {
  return (
    <div className="container section">
      <header className="page-heading">
        <h1>Anamnes inför rådgivning</h1>
        <p>Samla dina besvär och vanor som ett underlag för ett personligt samtal.</p>
      </header>
      <TcmAnamnes />
    </div>
  );
}
