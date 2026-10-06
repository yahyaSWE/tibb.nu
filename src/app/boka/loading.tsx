import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      variant="booking"
      eyebrow=""
      title="Boka en behandling"
      description="Hämtar behandlingar, behandlare och lediga tider."
    />
  );
}
