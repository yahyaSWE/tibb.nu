import { getCurrentUser } from "./auth";
import { DomainError } from "./db";
import { UploadError, readLimitedStream } from "./uploads";

export async function uploadAdmin(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    throw new UploadError(
      "Logga in som administratör för att ladda upp filer.",
      401,
    );
  if (user.role !== "admin")
    throw new UploadError("Du har inte behörighet att ladda upp filer.", 403);
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin];
  if (process.env.APP_URL) allowed.push(new URL(process.env.APP_URL).origin);
  if (
    !origin ||
    !allowed.includes(origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new UploadError("Uppladdningen måste göras från hemsidan.", 403);
  return user;
}
export async function uploadJson(request: Request) {
  if (!request.body) throw new UploadError("Uppladdningsuppgifter saknas.");
  const bytes = await readLimitedStream(request.body, 16 * 1024);
  try {
    return JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new UploadError("Uppladdningsuppgifterna kunde inte läsas.");
  }
}
export function uploadResponseError(error: unknown) {
  if (error instanceof DomainError)
    return Response.json(
      { error: error.message },
      { status: error instanceof UploadError ? error.status : 403 },
    );
  console.error(
    "Upload failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error:
        "Filen kunde inte sparas. Försök igen. Kontrollera fillagringen i Vercel om felet kvarstår.",
    },
    { status: 500 },
  );
}
