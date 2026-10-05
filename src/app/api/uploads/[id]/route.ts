import { getCurrentUser } from "@/lib/auth";
import { getReadableUpload, openUpload, UploadError } from "@/lib/uploads";
import { uploadResponseError } from "@/lib/upload-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const upload = await getReadableUpload(id, await getCurrentUser());
    if (!upload)
      throw new UploadError("Filen finns inte eller du saknar åtkomst.", 404);
    const response = await openUpload(upload);
    response.headers.set("Content-Type", upload.contentType);
    response.headers.set("Content-Length", String(upload.size));
    response.headers.set(
      "Content-Disposition",
      `${upload.kind === "practitioner-photo" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(upload.filename)}`,
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Content-Security-Policy", "sandbox");
    return response;
  } catch (error) {
    return uploadResponseError(error);
  }
}
