import { redirect } from "next/navigation";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Bokning" };

export default async function BookingAlias({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  redirect("/boka" + (error ? "?error=" + encodeURIComponent(error) : ""));
}
