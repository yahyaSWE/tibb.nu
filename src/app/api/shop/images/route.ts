import { DomainError } from "@/lib/db";
import { SHOP_IMAGE_LIMIT, saveShopImage } from "@/lib/shop-images";
import { uploadAdmin, uploadResponseError } from "@/lib/upload-http";
import { readLimitedStream, UploadError } from "@/lib/uploads";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await uploadAdmin(request);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;")) throw new UploadError("Välj en bild att ladda upp.");
    if (!request.body) throw new UploadError("Välj en bild att ladda upp.");
    const bytes = await readLimitedStream(request.body, SHOP_IMAGE_LIMIT + 65536);
    const form = await new Request("http://localhost/", {
      method: "POST", headers: { "Content-Type": contentType }, body: new Uint8Array(bytes),
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > SHOP_IMAGE_LIMIT) throw new UploadError("Välj en bild på högst 2 MB.");
    const result = await saveShopImage(user.id, Buffer.from(await file.arrayBuffer()));
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UploadError) return uploadResponseError(error);
    if (error instanceof DomainError) return Response.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return uploadResponseError(error);
  }
}
