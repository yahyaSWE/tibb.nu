export type User = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "student";
  createdAt: string;
};
export type Treatment = {
  id: number;
  name: string;
  description: string;
  durationMinutes: number;
  priceOre: number;
  active: boolean;
};
export type Practitioner = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};
export type Slot = {
  id: number;
  treatmentId: number;
  treatmentName: string;
  practitionerId: number;
  practitionerName: string;
  start: string;
  end: string;
  booked: boolean;
  blocked: boolean;
  scheduleId: number | null;
};
export type AvailabilityBreak = { startTime: string; endTime: string };
export type AvailabilityScheduleInput = {
  treatmentId: number;
  practitionerId?: number;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  breaks: AvailabilityBreak[];
};
export type AvailabilitySchedule = AvailabilityScheduleInput & {
  id: number;
  practitionerId: number;
  practitionerName: string;
  treatmentName: string;
  createdAt: string;
  created: number;
  skipped: number;
};
export type AvailabilityBlockInput = {
  practitionerId?: number | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: string;
};
export type AvailabilityBlock = {
  id: number;
  practitionerId: number | null;
  practitionerName: string | null;
  start: string;
  end: string;
  allDay: boolean;
  reason: string;
  createdAt: string;
};
export type Booking = {
  id: number;
  reference: string;
  treatmentId: number;
  slotId: number;
  treatmentName: string;
  practitionerId: number;
  practitionerName: string;
  durationMinutes: number;
  priceOre: number;
  start: string;
  end: string;
  name: string;
  email: string;
  phone: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  paymentMethod: "onsite" | "stripe";
  paymentStatus: "pending" | "paid" | "refunded";
  checkoutSessionId: string | null;
  expiresAt: string | null;
  createdAt: string;
};
export type Article = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Course = {
  id: number;
  title: string;
  slug: string;
  description: string;
  priceOre: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Lesson = {
  id: number;
  courseId: number;
  title: string;
  body: string;
  videoUrl: string;
  materialUrl: string;
  position: number;
};
export type Enrollment = {
  id: number;
  userId: number;
  courseId: number;
  name: string;
  email: string;
  courseTitle: string;
  createdAt: string;
};
export type Settings = {
  siteName: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  payOnSite: boolean;
  stripeEnabled: boolean;
};
