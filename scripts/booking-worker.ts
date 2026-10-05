import { getDb, reserveBooking } from "../src/lib/db";

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.VERCEL;

async function main() {
  try {
    const booking = await reserveBooking({
      slotId: Number(process.argv[2]),
      name: "Concurrent test",
      email: "concurrency@example.test",
      phone: "",
      paymentMethod: "onsite",
    });
    process.stdout.write(JSON.stringify({ ok: true, id: booking.id }));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : "Failed",
      }),
    );
  } finally {
    await getDb().close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
