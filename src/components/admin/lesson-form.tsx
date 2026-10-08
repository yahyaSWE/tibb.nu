import { saveLessonAction } from "@/lib/actions";
import type { Lesson } from "@/lib/types";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";
import { FileUpload } from "./file-upload";

export function LessonForm({
  lesson,
  courseId,
  returnTo,
  position,
}: {
  lesson?: Lesson;
  courseId: number;
  returnTo: string;
  position: number;
}) {
  const prefix = lesson ? `lesson-${lesson.id}` : "new-lesson";
  return (
    <form action={saveLessonAction} className="stack">
      <ReturnTo path={returnTo} />
      <input type="hidden" name="courseId" value={courseId} />
      {lesson ? <input type="hidden" name="id" value={lesson.id} /> : null}
      <div className="form-grid">
        <Field label="Lektionens namn" name={`${prefix}-title`}>
          <input
            id={`${prefix}-title`}
            name="title"
            required
            maxLength={180}
            defaultValue={lesson?.title}
            placeholder="Lektionens namn"
          />
        </Field>
        <Field
          label="Ordning"
          name={`${prefix}-position`}
          help="Lägre tal visas först."
        >
          <input
            id={`${prefix}-position`}
            name="position"
            type="number"
            min={1}
            max={10000}
            required
            defaultValue={lesson?.position ?? position}
          />
        </Field>
      </div>
      <Field
        label="Lektionstext"
        name={`${prefix}-body`}
        help="Du kan kombinera text, video och material. En lektion kan också bestå enbart av uppladdade filer."
      >
        <textarea
          id={`${prefix}-body`}
          name="body"
          rows={8}
          maxLength={100000}
          defaultValue={lesson?.body}
          placeholder="Skriv lektionens innehåll…"
        />
      </Field>
      <Field
        label="Videolänk"
        name={`${prefix}-videoUrl`}
        help="En länk till YouTube, Vimeo eller en videofil. YouTube kan visa kanalnamn och länkar i spelaren. Använd en direkt MP4- eller WebM-länk för Tibb.nu:s egen spelare."
      >
        <input
          id={`${prefix}-videoUrl`}
          name="videoUrl"
          type="url"
          maxLength={2000}
          defaultValue={lesson?.videoUrl}
          placeholder="https://…"
        />
      </Field>
      <FileUpload
        key={lesson ? `lesson-${lesson.id}` : `new-lesson-${position}`}
        kind="lesson-material"
        inputName="materialUploadIds"
        courseId={courseId}
        currentFiles={lesson?.materials || []}
        multiple
      />
      <Field
        label="Länk till kursmaterial"
        name={`${prefix}-materialUrl`}
        help="Valfritt alternativ eller komplement till uppladdade filer: ett arbetsblad eller annat material på en säker webbadress."
      >
        <input
          id={`${prefix}-materialUrl`}
          name="materialUrl"
          type="url"
          maxLength={2000}
          defaultValue={lesson?.materialUrl}
          placeholder="https://…"
        />
      </Field>
      <div>
        <SubmitButton>
          {lesson ? "Spara lektion" : "Lägg till lektion"}
        </SubmitButton>
      </div>
    </form>
  );
}
