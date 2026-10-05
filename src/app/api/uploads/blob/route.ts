import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { getPendingUpload, UploadError } from "@/lib/uploads";
import {
  uploadAdmin,
  uploadJson,
  uploadResponseError,
} from "@/lib/upload-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await uploadAdmin(request);
    const body = await uploadJson(request);
    if (body.type !== "blob.generate-presigned-url")
      throw new UploadError("Ogiltig uppladdningsbegäran.");
    const response = await handleUploadPresigned({
      body: body as unknown as HandleUploadPresignedBody,
      request,
      getSignedToken: async (pathname, payload, multipart) => {
        if (multipart) throw new UploadError("Filen får vara högst 20 MB.");
        const { id } = JSON.parse(payload || "{}");
        if (typeof id !== "string")
          throw new UploadError("Uppladdningen saknas.");
        const pending = await getPendingUpload(user.id, id);
        if (
          pending.storageProvider !== "blob" ||
          pathname !== pending.storagePath
        )
          throw new UploadError("Ogiltig uppladdningssökväg.");
        const validUntil = Date.now() + 10 * 60 * 1000;
        return {
          token: await issueSignedToken({
            pathname,
            operations: ["put"],
            validUntil,
            allowedContentTypes: [pending.contentType],
            maximumSizeInBytes: pending.size,
          }),
          urlOptions: {
            access: "private",
            allowOverwrite: false,
            validUntil,
            contentType: pending.contentType,
            maximumSizeInBytes: pending.size,
            allowedContentTypes: [pending.contentType],
          },
        };
      },
    });
    return Response.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return uploadResponseError(error);
  }
}
