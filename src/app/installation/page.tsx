import { Sprout } from "lucide-react";
export const metadata = {
  title: "Välkommen snart",
  robots: { index: false, follow: false },
};
export default function InstallationPage() {
  return (
    <section className="section container narrow">
      <div className="empty-state">
        <Sprout size={35} strokeWidth={1.2} />
        <span className="eyebrow">TIBB.NU</span>
        <h1 style={{ fontSize: "clamp(38px,5vw,58px)", marginBlock: 20 }}>
          Vi förbereder
          <br />
          något fint.
        </h1>
        <p>
          En plats för tradition, lärande och omtanke.
          <br />
          Välkommen tillbaka när mottagningen öppnar.
        </p>
      </div>
    </section>
  );
}
