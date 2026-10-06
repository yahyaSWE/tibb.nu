import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      variant="booking"
      eyebrow="Ett personligt möte"
      title="En tid för dig."
      description="Hämtar behandlingar, behandlare och lediga tider."
    />
  );
}
