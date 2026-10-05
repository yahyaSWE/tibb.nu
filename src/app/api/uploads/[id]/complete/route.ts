import {
  completeUpload,
  getPendingUpload,
  readLimitedStream,
  UploadError,
} from "@/lib/uploads";
import { uploadAdmin, uploadResponseError } from "@/lib/upload-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await uploadAdmin(request);
    const { id } = await params;
    let bytes: Buffer | undefined;
    if (request.headers.get("content-type") === "application/octet-stream") {
      const pending = await getPendingUpload(user.id, id);
      if (pending.storageProvider !== "local" || process.env.VERCEL)
        throw new UploadError("Den här uppladdningen stöds inte.");
      if (!request.body) throw new UploadError("Filens innehåll saknas.");
      bytes = await readLimitedStream(request.body, pending.size);
    }
    return Response.json(await completeUpload(user.id, id, bytes), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return uploadResponseError(error);
  }
}
