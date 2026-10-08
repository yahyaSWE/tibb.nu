import { unstable_rethrow } from "next/navigation";
import type { ActivityActionState } from "./activity-action-state";

type LessonActivityAction = (
  previous: ActivityActionState,
  form: FormData,
) => Promise<ActivityActionState>;

// Client-side transport failures must not replace the controlled form with an
// error boundary. Authentication redirects and other Next control flow still
// need to reach the router, without being reported as a failed save.
export function withLessonActivityErrors(action: LessonActivityAction) {
  return async (
    previous: ActivityActionState,
    form: FormData,
  ): Promise<ActivityActionState> => {
    try {
      return await action(previous, form);
    } catch (error) {
      unstable_rethrow(error);
      return {
        error:
          "Svaret kunde inte sparas. Dina svar finns kvar i formuläret. Kontrollera anslutningen och försök igen.",
      };
    }
  };
}
