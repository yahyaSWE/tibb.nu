import { z } from 'zod';

const plain = (value: string) => !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value);
export const IntakeContactSchema = z.object({
  name:z.string().trim().min(1).max(120).refine(plain),
  email:z.string().trim().pipe(z.email().max(254)),
  phone:z.string().trim().max(50).refine(plain).default(''),
}).strict();
export type IntakeContact = z.infer<typeof IntakeContactSchema>;
