import { saveTreatmentAction } from "@/lib/actions";
import { Field, ReturnTo } from "./common";
import { SubmitButton } from "./submit-button";

type TreatmentFormValue = {
  id: number;
  name: string;
  description: string;
  durationMinutes: number;
  priceOre: number;
  active: boolean;
};

export function TreatmentForm({
  treatment,
  returnTo,
}: {
  treatment?: TreatmentFormValue;
  returnTo: string;
}) {
  return (
    <form action={saveTreatmentAction} className="stack">
      <ReturnTo path={returnTo} />
      {treatment ? (
        <input type="hidden" name="id" value={treatment.id} />
      ) : null}
      <Field label="Behandlingens namn" name="name">
        <input
          id="name"
          name="name"
          required
          maxLength={150}
          defaultValue={treatment?.name}
          placeholder="Till exempel: Första konsultation"
        />
      </Field>
      <Field label="Beskrivning" name="description">
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          maxLength={5000}
          defaultValue={treatment?.description}
          placeholder="Beskriv vad besöket innehåller och vem det passar."
        />
      </Field>
      <div className="form-grid">
        <Field
          label="Längd (minuter)"
          name="durationMinutes"
          help={
            treatment
              ? "Ta bort framtida tider innan du ändrar längden."
              : undefined
          }
        >
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={480}
            step={1}
            required
            defaultValue={treatment?.durationMinutes || 60}
          />
        </Field>
        <Field label="Pris (kr)" name="price">
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            required
            defaultValue={treatment ? treatment.priceOre / 100 : undefined}
            placeholder="850"
          />
        </Field>
      </div>
      <label className="form-check">
        <input
          type="checkbox"
          name="active"
          defaultChecked={treatment?.active ?? true}
        />
        <span>Visa behandlingen på bokningssidan</span>
      </label>
      <div>
        <SubmitButton>
          {treatment ? "Spara ändringar" : "Lägg till behandling"}
        </SubmitButton>
      </div>
    </form>
  );
}
