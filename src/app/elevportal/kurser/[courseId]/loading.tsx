import { RouteLoading } from "@/components/route-loading";

export default function Loading() {
  return (
    <RouteLoading
      variant="lesson"
      eyebrow="En lektion i taget"
      title="Din kurs"
      description="Hämtar kursinnehållet och dina framsteg."
    />
  );
}
