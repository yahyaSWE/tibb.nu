"use client";

import { saveArticleContentAction } from "@/lib/content-actions";
import { useContentForm } from "@/lib/use-content-form";
import type { ArticleFields } from "@/lib/content-action-state";
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
  const form = useContentForm<ArticleFields>(
    saveArticleContentAction,
    {
      title: article?.title ?? "",
      slug: article?.slug ?? "",
      excerpt: article?.excerpt ?? "",
      body: article?.body ?? "",
      published: article?.published ?? false,
    },
    `article-${article?.id ?? "new"}`,
  );
  return (
    <form
      action={form.action}
      onSubmit={form.onSubmit}
      aria-busy={form.pending}
      className="stack"
    >
      <ReturnTo path={returnTo} />
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      {form.error && (
        <div
          className="notice notice-error"
          role="alert"
          tabIndex={-1}
          ref={form.errorRef}
        >
          {form.error}
        </div>
      )}
      <fieldset disabled={form.pending} className="stack content-form-fields">
        <legend className="sr-only">Artikelns innehåll</legend>
        <Field label="Rubrik" name="title">
          <input
            id="title"
            name="title"
            required
            maxLength={180}
            value={form.values.title}
            onChange={(event) =>
              form.setValues({ ...form.values, title: event.target.value })
            }
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
            value={form.values.slug}
            onChange={(event) =>
              form.setValues({ ...form.values, slug: event.target.value })
            }
            placeholder="till-exempel-en-artikel"
          />
        </Field>
        <Field label="Ingress" name="excerpt">
          <textarea
            id="excerpt"
            name="excerpt"
            maxLength={500}
            rows={3}
            value={form.values.excerpt}
            onChange={(event) =>
              form.setValues({ ...form.values, excerpt: event.target.value })
            }
            placeholder="En kort introduktion som visas i artikelöversikten."
          />
        </Field>
        <Field
          label="Artikeltext"
          name="body"
          help="Tomma rader skiljer stycken. Skriv ## följt av en underrubrik på egen rad. Lägg till länkar med [Källans namn](https://exempel.se) eller [Kontakt](/kontakt). HTML stöds inte."
        >
          <textarea
            id="body"
            name="body"
            rows={16}
            maxLength={100000}
            value={form.values.body}
            onChange={(event) =>
              form.setValues({ ...form.values, body: event.target.value })
            }
            placeholder="Skriv din artikel här…"
          />
        </Field>
        <label className="form-check">
          <input
            type="checkbox"
            name="published"
            checked={form.values.published}
            onChange={(event) =>
              form.setValues({
                ...form.values,
                published: event.target.checked,
              })
            }
          />
          <span>Publicera artikeln på hemsidan</span>
        </label>
      </fieldset>
      <div>
        <SubmitButton>
          {article ? "Spara artikel" : "Skapa artikel"}
        </SubmitButton>
      </div>
    </form>
  );
}
