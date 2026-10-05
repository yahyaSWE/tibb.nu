export function databaseConfigured(): boolean {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (url || token) {
    try {
      const parsed = new URL(url || "");
      return (
        !!token &&
        ["libsql:", "https:"].includes(parsed.protocol) &&
        !!parsed.hostname &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }
  return !process.env.VERCEL;
}
