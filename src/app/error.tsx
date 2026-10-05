"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section container narrow empty-state">
      <h1>Det gick inte att visa sidan.</h1>
      <p>Försök igen om en stund.</p>
      <button className="button button-primary" onClick={reset}>
        Försök igen
      </button>
    </section>
  );
}
