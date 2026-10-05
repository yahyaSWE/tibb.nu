import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Writable } from "node:stream";
import { existsSync } from "node:fs";
import { createFirstAdmin, hasAdmin } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { signupSchema } from "../src/lib/validation";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
async function main() {
  if (await hasAdmin()) {
    console.log("Ett administratörskonto finns redan. Logga in på /logga-in.");
    return;
  }
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) stdout.write(chunk);
      callback();
    },
  });
  const prompt = createInterface({
    input: stdin,
    output,
    terminal: !!stdin.isTTY,
  });
  try {
    const name = await prompt.question("Namn: ");
    const email = await prompt.question("E-postadress: ");
    let password = process.env.TIBB_ADMIN_PASSWORD;
    if (!password) {
      stdout.write("Lösenord (minst 12 tecken): ");
      muted = true;
      password = await prompt.question("");
      muted = false;
      stdout.write("\n");
    }
    const input = signupSchema.parse({ name, email, password });
    await createFirstAdmin({
      name: input.name,
      email: input.email,
      passwordHash: hashPassword(input.password),
    });
    console.log("Administratörskontot är skapat. Logga in på /logga-in.");
  } finally {
    prompt.close();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Konfigurationen misslyckades.",
  );
  process.exitCode = 1;
});
