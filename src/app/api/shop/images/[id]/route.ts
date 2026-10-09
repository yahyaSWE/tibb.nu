import { getCurrentUser } from "@/lib/auth";
import { readShopImage } from "@/lib/shop-images";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const bytes = await readShopImage(id, user?.role === "admin" ? user.id : undefined);
  if (!bytes) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "image/webp", "Content-Length": String(bytes.length),
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'",
  } });
}
