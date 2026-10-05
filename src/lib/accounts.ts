import { DomainError, createUser, getUserByEmail } from "./db";
import { hashPassword } from "./security";
import { signupSchema } from "./validation";
export async function registerStudent(input: unknown) {
  const value = signupSchema.parse(input);
  if (await getUserByEmail(value.email))
    throw new DomainError(
      "E-postadressen används redan. Logga in med ditt konto.",
    );
  return await createUser({
    name: value.name,
    email: value.email,
    passwordHash: hashPassword(value.password),
    role: "student",
  });
}
