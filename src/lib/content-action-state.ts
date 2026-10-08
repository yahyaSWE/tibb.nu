export type ArticleFields = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  published: boolean;
};

export type CourseFields = {
  title: string;
  slug: string;
  description: string;
  price: string;
  published: boolean;
};

export type LessonFields = {
  title: string;
  position: string;
  body: string;
  videoUrl: string;
  materialUrl: string;
  materialUploadIds?: string[];
};

export type ContentActionState<Values> = {
  error?: string;
  values?: Values;
};

function stringField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

// Preserve the submitted strings, including whitespace and decimal prices.
// Domain validation normalizes only the values actually written to the database.
export function articleFields(form: FormData): ArticleFields {
  return {
    title: stringField(form, "title"),
    slug: stringField(form, "slug"),
    excerpt: stringField(form, "excerpt"),
    body: stringField(form, "body"),
    published: stringField(form, "published") === "on",
  };
}

export function courseFields(form: FormData): CourseFields {
  return {
    title: stringField(form, "title"),
    slug: stringField(form, "slug"),
    description: stringField(form, "description"),
    price: stringField(form, "price"),
    published: stringField(form, "published") === "on",
  };
}

export function lessonFields(form: FormData): LessonFields {
  return {
    title: stringField(form, "title"),
    position: stringField(form, "position"),
    body: stringField(form, "body"),
    videoUrl: stringField(form, "videoUrl"),
    materialUrl: stringField(form, "materialUrl"),
    materialUploadIds: form.has("materialUploadIdsPresent")
      ? form
          .getAll("materialUploadIds")
          .filter((value): value is string => typeof value === "string")
      : undefined,
  };
}
