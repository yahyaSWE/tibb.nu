import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/database-config";

export function proxy(request: NextRequest) {
  const needsDatabase = !!process.env.VERCEL && !databaseConfigured();
  const path = request.nextUrl.pathname;
  // Discovery routes must return their own robots/XML/text responses even
  // during installation, instead of a successful HTML rewrite.
  if (!needsDatabase || ["/installation", "/robots.txt", "/sitemap.xml", "/llms.txt", "/opengraph-image"].includes(path))
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
  return NextResponse.rewrite(destination, { status: 503 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|images/).*)"],
};
