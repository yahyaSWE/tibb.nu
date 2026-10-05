import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

export const metadata = { title: "Om Tibb" };
export default function AboutPage() {
  return (
    <div className="container section">
      <div className="page-heading">
        <span className="eyebrow">OM TIBB.NU</span>
        <h1>
          Rotad i tradition.
          <br />
          <em>Med människan i centrum.</em>
        </h1>
      </div>
      <div className="about-grid">
        <div className="about-image">
          <Image
            src="/images/olive-still-life.png"
            alt="Olivträdets blad och keramik i solljus"
            fill
            sizes="(max-width:760px) 100vw, 45vw"
          />
        </div>
        <div className="prose">
          <h2>En plats för möten och kunskap.</h2>
          <p>
            Tibb.nu är en plats för klassisk kinesisk medicin i ljuset av den
            Profetiska vägledningen. Här ryms personliga möten, lärande och
            reflektion.
          </p>
          <p>
            Vårt förhållningssätt börjar med att lyssna. Vi värdesätter varje
            människas berättelse, respekt för traditionernas ursprung och ett
            varsamt sätt att dela kunskap.
          </p>
          <h3>Olivträdet som inspiration</h3>
          <p>
            Olivträdet står för våra visuella rötter: långsam tillväxt, naturlig
            enkelhet och ett lugnt uttryck. Här finns utrymme att stanna upp och
            fördjupa din förståelse.
          </p>
          <Link href="/boka" className="button button-primary">
            Utforska behandlingar <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
