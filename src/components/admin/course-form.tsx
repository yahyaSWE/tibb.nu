import { saveCourseAction } from "@/lib/actions";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";

type CourseFormValue = {
  id: number;
  title: string;
  slug: string;
  description: string;
  priceOre: number;
  published: boolean;
};

export function CourseForm({
  course,
  returnTo,
}: {
  course?: CourseFormValue;
  returnTo: string;
}) {
  return (
    <form action={saveCourseAction} className="stack">
      <ReturnTo path={returnTo} />
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <Field label="Kursens namn" name="title">
        <input
          id="title"
          name="title"
          required
          maxLength={180}
          defaultValue={course?.title}
          placeholder="Ge kursen ett tydligt namn"
        />
      </Field>
      <Field
        label="Adressnamn"
        name="slug"
        help="Lämna tomt för att skapa ett adressnamn från kursens namn."
      >
        <input
          id="slug"
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={100}
          defaultValue={course?.slug}
          placeholder="kursens-namn"
        />
      </Field>
      <Field label="Kursbeskrivning" name="description">
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          maxLength={10000}
          defaultValue={course?.description}
          placeholder="Beskriv vad eleven får lära sig och vem kursen passar."
        />
      </Field>
      <Field
        label="Pris (kr)"
        name="price"
        help="Visas i kurskatalogen. Du tilldelar elevens tillgång från administrationen."
      >
        <input
          id="price"
          name="price"
          type="number"
          required
          min={0}
          step="0.01"
          max={100000}
          defaultValue={course ? course.priceOre / 100 : 0}
        />
      </Field>
      {course ? (
        <label className="form-check">
          <input
            type="checkbox"
            name="published"
            defaultChecked={course.published}
          />
          <span>Visa kursen i kurskatalogen</span>
        </label>
      ) : (
        <p className="muted">
          Kursen skapas som ett utkast. Lägg till lektioner i kursbyggaren och
          publicera sedan.
        </p>
      )}
      <div>
        <SubmitButton>
          {course ? "Spara kurs" : "Skapa kursutkast"}
        </SubmitButton>
      </div>
    </form>
  );
}
