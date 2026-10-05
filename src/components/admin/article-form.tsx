import { saveArticleAction } from "@/lib/actions";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";

type ArticleFormValue = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  published: boolean;
};

export function ArticleForm({
  article,
  returnTo,
}: {
  article?: ArticleFormValue;
  returnTo: string;
}) {
  return (
    <form action={saveArticleAction} className="stack">
      <ReturnTo path={returnTo} />
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <Field label="Rubrik" name="title">
        <input
          id="title"
          name="title"
          required
          maxLength={180}
          defaultValue={article?.title}
          placeholder="Artikelns rubrik"
        />
      </Field>
      <Field
        label="Adressnamn"
        name="slug"
        help="Lämna tomt för att skapa ett adressnamn från rubriken. Använd bokstäver, siffror och bindestreck."
      >
        <input
          id="slug"
          name="slug"
          maxLength={100}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={article?.slug}
          placeholder="till-exempel-en-artikel"
        />
      </Field>
      <Field label="Ingress" name="excerpt">
        <textarea
          id="excerpt"
          name="excerpt"
          maxLength={500}
          rows={3}
          defaultValue={article?.excerpt}
          placeholder="En kort introduktion som visas i artikelöversikten."
        />
      </Field>
      <Field
        label="Artikeltext"
        name="body"
        help="Skriv texten med tomma rader mellan styckena."
      >
        <textarea
          id="body"
          name="body"
          rows={16}
          maxLength={100000}
          defaultValue={article?.body}
          placeholder="Skriv din artikel här…"
        />
      </Field>
      <label className="form-check">
        <input
          type="checkbox"
          name="published"
          defaultChecked={article?.published ?? false}
        />
        <span>Publicera artikeln på hemsidan</span>
      </label>
      <div>
        <SubmitButton>
          {article ? "Spara artikel" : "Skapa artikel"}
        </SubmitButton>
      </div>
    </form>
  );
}
