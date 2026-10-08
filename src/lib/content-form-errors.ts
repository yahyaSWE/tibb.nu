import { unstable_rethrow } from "next/navigation";
import type { ContentActionState } from "./content-action-state";

export function withContentFormErrors<Values>(action: (previous: ContentActionState<Values>, form: FormData) => Promise<ContentActionState<Values>>) {
  return async (previous: ContentActionState<Values>, form: FormData): Promise<ContentActionState<Values>> => {
    try { return await action(previous, form); }
    catch (error) {
      unstable_rethrow(error);
      // No stale values: the controlled client state holds the latest edits.
      return { error: "Det gick inte att spara. Din inmatning finns kvar. Kontrollera anslutningen och försök igen." };
    }
  };
}
