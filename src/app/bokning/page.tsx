import { redirect } from "next/navigation";
export default async function BookingAlias({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  redirect("/boka" + (error ? "?error=" + encodeURIComponent(error) : ""));
}
