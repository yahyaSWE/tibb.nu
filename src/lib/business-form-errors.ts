import { unstable_rethrow } from "next/navigation";
import type { BusinessFormState } from "./business-form-state";

export function withBusinessFormErrors(
  action: (previous: BusinessFormState, form: FormData) => Promise<BusinessFormState>,
) {
  return async (previous: BusinessFormState, form: FormData): Promise<BusinessFormState> => {
    try {
      return await action(previous, form);
    } catch (error) {
      unstable_rethrow(error);
      return {
        error: "Det gick inte att spara. Din inmatning finns kvar. Kontrollera anslutningen och försök igen.",
        success: null,
      };
    }
  };
}
