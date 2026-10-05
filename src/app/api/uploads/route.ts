import { prepareUpload, UploadError } from "@/lib/uploads";
import {
  uploadAdmin,
  uploadJson,
  uploadResponseError,
} from "@/lib/upload-http";
import type { UploadKind } from "@/lib/upload-rules";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await uploadAdmin(request);
    const input = await uploadJson(request);
    if (typeof input.filename !== "string" || typeof input.size !== "number")
      throw new UploadError("Välj en fil att ladda upp.");
    const prepared = await prepareUpload(user.id, {
      kind: input.kind as UploadKind,
      filename: input.filename,
      size: input.size,
      courseId: typeof input.courseId === "number" ? input.courseId : undefined,
    });
    return Response.json(prepared, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return uploadResponseError(error);
  }
}
