import { requireAdmin } from "@/lib/auth";
import { getPractitioners } from "@/lib/db";
import {
  archivePractitionerAction,
  savePractitionerAction,
} from "@/lib/actions";
import {
  AdminHeading,
  AdminNotice,
  type AdminSearchParams,
  EmptyState,
  Field,
  ReturnTo,
  SectionHeading,
} from "@/components/admin/common";
import { SubmitButton } from "@/components/admin/submit-button";
import { FileUpload } from "@/components/admin/file-upload";
import { UserRound } from "lucide-react";
import type { Practitioner } from "@/lib/types";

function PractitionerForm({ practitioner }: { practitioner?: Practitioner }) {
  const prefix = `practitioner-${practitioner?.id || "new"}`;
  return (
    <form action={savePractitionerAction} className="stack">
      <ReturnTo path="/admin/behandlare" />
      {practitioner && (
        <input type="hidden" name="id" value={practitioner.id} />
      )}
      <Field label="Namn" name={`${prefix}-name`}>
        <input
          id={`${prefix}-name`}
          name="name"
          defaultValue={practitioner?.name || ""}
          required
          minLength={2}
          maxLength={150}
          placeholder="Behandlarens namn"
        />
      </Field>
      <Field
        label="Presentation"
        name={`${prefix}-description`}
        help="Visas när kunden väljer behandlare på bokningssidan."
      >
        <textarea
          id={`${prefix}-description`}
          name="description"
          defaultValue={practitioner?.description || ""}
          rows={3}
          maxLength={3000}
          placeholder="Kort presentation av behandlaren"
        />
      </Field>
      <div className="practitioner-photo-field">
        <p className="practitioner-photo-label">Porträttbild (valfritt)</p>
        <FileUpload
          kind="practitioner-photo"
          inputName="photoUploadId"
          currentFiles={practitioner?.photo ? [practitioner.photo] : []}
          multiple={false}
        />
        <p className="practitioner-photo-help">
          Bilden visas när kunden väljer behandlare. Spara ändringarna för att
          uppdatera eller ta bort den.
        </p>
      </div>
      <label className="form-check">
        <input
          type="checkbox"
          name="active"
          defaultChecked={practitioner?.active ?? true}
        />
        <span>Synlig och bokningsbar</span>
      </label>
      <div>
        <SubmitButton pendingLabel="Sparar behandlare…">
          {practitioner ? "Spara ändringar" : "Lägg till behandlare"}
        </SubmitButton>
      </div>
    </form>
  );
}

export default async function PractitionersPage({
  searchParams,
}: {
  searchParams: AdminSearchParams;
}) {
  await requireAdmin();
  const practitioners = await getPractitioners();
  return (
    <>
      <AdminHeading
        title="Behandlare"
        description="Presentera dina behandlare och ge var och en ett eget schema för bokningar."
      />
      <AdminNotice searchParams={searchParams} />
      {practitioners.some((practitioner) => practitioner.name === "Tibb.nu") && (
        <p className="notice">Standardprofilen heter Tibb.nu. Ange behandlarens offentliga namn och en valfri porträttbild här innan bokningen öppnas. För Johan: Johan Yahya Blomdahl.</p>
      )}
      <div className="split-grid">
        <section className="panel">
          <SectionHeading
            title="Dina behandlare"
            description="Redigera namn och presentation. Befintliga tider är kopplade till Tibb.nu; ändra namnet till din behandlares namn."
          />
          {practitioners.length ? (
            <div className="stack">
              {practitioners.map((person) => (
                <details className="panel lesson-card" key={person.id}>
                  <summary>
                    <span className="practitioner-admin-avatar">
                      {person.photoUrl ? (
                        <img
                          src={person.photoUrl}
                          alt={person.name}
                          width={48}
                          height={48}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <UserRound size={20} aria-hidden="true" />
                      )}
                    </span>
                    <strong>{person.name}</strong>
                    <span
                      className={`badge ${person.active ? "badge-green" : ""}`}
                    >
                      {person.active ? "Aktiv" : "Inaktiv"}
                    </span>
                    <span className="muted">Redigera</span>
                  </summary>
                  <div className="lesson-editor">
                    <PractitionerForm practitioner={person} />
                    {person.active && (
                      <form
                        action={archivePractitionerAction}
                        className="lesson-delete"
                      >
                        <input type="hidden" name="id" value={person.id} />
                        <ReturnTo path="/admin/behandlare" />
                        <SubmitButton
                          className="button button-secondary button-small"
                          pendingLabel="Inaktiverar…"
                        >
                          Inaktivera behandlare
                        </SubmitButton>
                        <p
                          className="muted"
                          style={{ fontSize: 12, marginTop: 12 }}
                        >
                          Behandlaren slutar visas för kunder. Bokningar och
                          historik finns kvar, och du kan aktivera personen
                          igen.
                        </p>
                      </form>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <EmptyState title="Lägg till din första behandlare">
              Skapa en behandlare och välj sedan behandlingar och arbetstider
              under Tillgängliga tider.
            </EmptyState>
          )}
        </section>
        <section className="panel">
          <SectionHeading
            title="Ny behandlare"
            description="Lägg till personen här och publicera sedan tider i personens schema."
          />
          <PractitionerForm key={`new-practitioner-${practitioners.length}`} />
        </section>
      </div>
    </>
  );
}
