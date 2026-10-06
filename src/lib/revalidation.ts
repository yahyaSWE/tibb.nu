import "server-only";
import { revalidatePath } from "next/cache";

const relatedPages: Record<string, string[]> = {
  "/admin/behandlingar": [
    "/",
    "/boka",
    "/admin",
    "/admin/tider",
    "/admin/behandlingar/[id]",
  ],
  "/admin/behandlare": ["/", "/boka", "/admin/tider", "/admin/bokningar/[id]"],
  "/admin/tider": ["/boka", "/admin"],
  "/admin/bokningar": [
    "/boka",
    "/admin",
    "/admin/tider",
    "/admin/bokningar/[id]",
  ],
  "/bokning": ["/boka", "/admin", "/admin/bokningar", "/admin/tider"],
  "/admin/artiklar": [
    "/",
    "/artiklar",
    "/artiklar/[slug]",
    "/admin",
    "/admin/artiklar/[id]",
  ],
  "/admin/kurser": [
    "/",
    "/kurser",
    "/kurser/[slug]",
    "/admin",
    "/admin/elever",
    "/admin/kurser/[id]",
    "/elevportal",
    "/elevportal/kurser/[courseId]",
    "/elevportal/kurser/[courseId]/lektioner/[lessonId]",
  ],
  "/admin/elever": [
    "/admin",
    "/admin/kurser",
    "/admin/kurser/[id]",
    "/elevportal",
    "/elevportal/kurser/[courseId]",
    "/elevportal/kurser/[courseId]/lektioner/[lessonId]",
  ],
  "/elevportal": [
    "/elevportal/kurser/[courseId]",
    "/elevportal/kurser/[courseId]/lektioner/[lessonId]",
  ],
};

export function revalidateMutation(area: string, destination: string) {
  // Settings change the shared site chrome. Other mutations only refresh their
  // affected pages, preserving layouts and unrelated navigation preparation.
  if (area === "/admin/installningar") {
    revalidatePath("/", "layout");
    return;
  }
  const pages = new Set([area, ...(relatedPages[area] || [])]);
  if (destination.startsWith("/") && !destination.startsWith("//"))
    pages.add(destination.split("?")[0]);
  for (const page of pages)
    if (page.includes("[")) revalidatePath(page, "page");
    else revalidatePath(page);
}
