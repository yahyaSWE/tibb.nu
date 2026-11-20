import { getWellnessSeller } from "@/lib/wellness";
import { withdrawalFormText } from "@/lib/withdrawal-form-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const seller = await getWellnessSeller();
  return new Response(withdrawalFormText(seller), { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": 'attachment; filename="angerblankett-tibb.txt"',
    "Cache-Control": "no-store",
  } });
}
