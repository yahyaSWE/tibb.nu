import Link from "next/link";
export default function NotFound() {
  return (
    <section className="section container narrow empty-state">
      <span className="eyebrow">404</span>
      <h1>Sidan finns inte här.</h1>
      <p>Den kan ha flyttats eller inte vara publicerad ännu.</p>
      <Link href="/" className="button button-primary">
        Till startsidan
      </Link>
    </section>
  );
}
