import { getBookingReceipt } from "@/lib/booking-receipt";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request) {
  const reference = new URL(request.url).searchParams.get("ref") ?? "";
  if (!/^[a-f0-9]{32}$/.test(reference)) return new Response("Kvittot finns inte.", { status: 404, headers });
  const receipt = await getBookingReceipt(reference);
  if (!receipt) return new Response("Kvittot finns inte.", { status: 404, headers });
  return new Response(new Uint8Array(receipt.bytes), {
    headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Kvitto-${receipt.number}.pdf"` },
  });
}
