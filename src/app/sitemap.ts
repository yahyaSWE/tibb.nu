import type { MetadataRoute } from "next";
import { databaseConfigured } from "@/lib/database-config";
import { absoluteUrl, isIndexableDeployment, PUBLIC_PAGES } from "@/lib/seo";
import { getPublicSeoContent } from "@/lib/seo-data";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexableDeployment() || !databaseConfigured()) return [];

  const content = await getPublicSeoContent();
  if (content.installationRequired) return [];
  const entries: MetadataRoute.Sitemap = PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
  }));

  for (const [prefix, records] of [
    ["/artiklar/", content.articles],
    ["/kurser/", content.courses],
  ] as const) {
    for (const record of records) {
      // CMS truncation can leave a final hyphen. It is still a safe, existing
      // URL; reject path/query characters rather than rewriting that slug.
      if (!/^[a-z0-9][a-z0-9-]*$/.test(record.slug)) continue;
      const entry: MetadataRoute.Sitemap[number] = {
        url: absoluteUrl(`${prefix}${record.slug}`),
      };
      if (typeof record.updatedAt === "string" && record.updatedAt.trim()) {
        const modified = new Date(record.updatedAt);
        const savedDay = /^\d{4}-\d{2}-\d{2}/.exec(record.updatedAt)?.[0];
        const calendarDay = savedDay ? new Date(`${savedDay}T00:00:00.000Z`) : null;
        // Date() normalizes invalid calendar dates such as 31 February. Those
        // values are not a trustworthy lastmod, even when Date.parse accepts them.
        if (
          Number.isFinite(modified.getTime()) &&
          savedDay &&
          calendarDay &&
          Number.isFinite(calendarDay.getTime()) &&
          calendarDay.toISOString().startsWith(savedDay)
        ) {
          entry.lastModified = modified;
        }
      }
      entries.push(entry);
    }
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}
