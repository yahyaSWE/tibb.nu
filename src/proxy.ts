import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/database-config";

export function proxy(request: NextRequest) {
  const needsDatabase = !!process.env.VERCEL && !databaseConfigured();
  if (!needsDatabase || request.nextUrl.pathname === "/installation")
    return NextResponse.next();
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.method !== "GET"
  ) {
    return NextResponse.json(
      { error: "Tjänsten förbereds. Försök igen senare." },
      { status: 503 },
    );
  }
  const destination = request.nextUrl.clone();
  destination.pathname = "/installation";
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|images/).*)"],
};
