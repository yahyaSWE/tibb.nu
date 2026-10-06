import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      variant="portal"
      eyebrow="Din plats för kunskap"
      title="Din elevportal"
      description="Hämtar dina kurser och framsteg."
    />
  );
}
