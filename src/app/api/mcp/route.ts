import { createBookingMcpHandler } from "@/lib/mcp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handle = createBookingMcpHandler();
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export const OPTIONS = handle;
