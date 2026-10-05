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
export type Slot = {
  id: number;
  treatmentId: number;
  treatmentName: string;
  start: string;
  end: string;
  booked: boolean;
};
export type Booking = {
  id: number;
  reference: string;
  treatmentId: number;
  slotId: number;
  treatmentName: string;
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
