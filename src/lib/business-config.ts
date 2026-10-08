import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
export const businessSettingsSchema = z.object({
  legalName: shortText(150).min(2, "Ange verksamhetens juridiska namn."),
  organizationNumber: shortText(30).regex(/^\d{6}-\d{4}$/, "Ange organisationsnummer som 559363-3893."),
  cancellationHours: z.coerce.number().int().min(1).max(336),
  cancellationDetails: shortText(3000),
  courseAccessDescription: shortText(2000).min(1, "Beskriv hur länge kursåtkomsten gäller."),
  bookingRetention: shortText(2000),
  studentRetention: shortText(2000),
  legalBasis: shortText(4000),
  internationalTransfers: shortText(3000),
  additionalPrivacy: shortText(5000),
});
export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

// Facts supplied by the owner. No street address, contact channel, retention
// period, fee or data-transfer arrangement is invented here.
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  legalName: "Joart Group AB",
  organizationNumber: "559363-3893",
  cancellationHours: 24,
  cancellationDetails: "",
  courseAccessDescription: "Du har tillgång till din tilldelade kurs utan tidsgräns.",
  bookingRetention: "",
  studentRetention: "",
  legalBasis: "",
  internationalTransfers: "",
  additionalPrivacy: "",
};

export const courseInformationSchema = z.object({
  audience: shortText(2000),
  prerequisites: shortText(2000),
  learningOutcomes: shortText(4000),
  completionRequirements: shortText(2000),
});
export type CourseInformation = z.infer<typeof courseInformationSchema>;
export const EMPTY_COURSE_INFORMATION: CourseInformation = {
  audience: "", prerequisites: "", learningOutcomes: "", completionRequirements: "",
};

export function cancellationText(hours: number) {
  return `Återbud ska lämnas minst ${hours} timmar före din bokade tid.`;
}

export function missingPrivacyInformation(value: BusinessSettings) {
  return [
    !value.legalBasis && "Rättslig grund",
    !value.bookingRetention && "Lagring av bokningsuppgifter",
    !value.studentRetention && "Lagring av elevuppgifter",
    !value.internationalTransfers && "Leverantörer och överföringar utanför EU/EES",
  ].filter((item): item is string => !!item);
}
