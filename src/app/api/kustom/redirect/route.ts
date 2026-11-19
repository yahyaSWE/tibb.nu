import { getDb } from "@/lib/db";
import { getShopOrderByReference } from "@/lib/shop";
import { enforceRequestLimit } from "@/lib/request-rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("ref") || "";
  if (!/^[a-f0-9]{32}$/.test(reference)) return new Response("Ogiltig beställningslänk.", { status: 404 });
  await enforceRequestLimit("kustom-redirect", reference, 20, request.headers);
  const order = await getShopOrderByReference(reference);
  const checkout = await getDb().prepare("SELECT redirect_url FROM kustom_checkouts WHERE order_reference=?").get(reference);
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
  if (!order || order.status !== "pending" || !checkout?.redirect_url) return new Response("Betalningslänken är inte tillgänglig. Återgå till beställningsbekräftelsen.", { status: 409, headers });
  const url = new URL(String(checkout.redirect_url));
  if (url.protocol !== "https:" || url.username || url.password) return new Response("Betalningslänken kunde inte verifieras.", { status: 503, headers });
  return new Response(null, { status: 303, headers: { ...headers, Location: url.href } });
}
