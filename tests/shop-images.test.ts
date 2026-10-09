import { after, before, test, mock } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createFirstAdmin, createUser, getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { getAdminShopProduct, getPublicShopProducts, saveShopProduct } from "../src/lib/shop";
import { readShopImage, saveShopImage, SHOP_IMAGE_LIMIT } from "../src/lib/shop-images";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "STRIPE_SECRET_KEY", "SHOP_STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
let adminId: number, studentId: number;
before(async () => {
  adminId = (await createFirstAdmin({ name: "Shop image admin", email: "image-admin@example.test", passwordHash: hashPassword("isolated shop image test password") })).id;
  studentId = (await createUser({ name: "Shop image student", email: "image-student@example.test", passwordHash: hashPassword("isolated shop image student password"), role: "student" })).id;
});
after(async () => { await getDb().close(); });
async function png(width = 1800) {
  return sharp({ create: { width, height: 900, channels: 3, background: "#476556" } }).withMetadata().png().toBuffer();
}

test("product pictures are decoded, resized and stripped of source metadata", async () => {
  const upload = await saveShopImage(adminId, await png());
  assert.match(upload.id, /^[a-f0-9-]{36}$/);
  assert.equal(upload.url, `/api/shop/images/${upload.id}`);
  const bytes = await readShopImage(upload.id, adminId);
  assert.ok(bytes);
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.ok(bytes.length <= SHOP_IMAGE_LIMIT);
  assert.equal(await readShopImage(upload.id), null, "unattached pictures must remain private");
});

test("draft pictures require fresh admin access and public pictures require both visibility gates", async () => {
  const upload = await saveShopImage(adminId, await png(600));
  const id = await saveShopProduct(adminId, null, { name: "Image draft", slug: "image-draft", description: "PRIVATE_DRAFT_DESCRIPTION", priceOre: 10000, vatPercent: 25, stock: 2, published: false, imageId: upload.id });
  assert.equal(await readShopImage(upload.id, studentId), null);
  await getDb().prepare("UPDATE shop_settings SET enabled=1 WHERE id=1").run();
  assert.equal(await readShopImage(upload.id), null, "an open shop does not publish drafts");
  const draft = (await getAdminShopProduct(adminId, id))!;
  await saveShopProduct(adminId, id, { ...draft, published: true, expectedUpdatedAt: draft.updatedAt });
  assert.ok(await readShopImage(upload.id));
  assert.ok(!(await getPublicShopProducts()).some(value => Object.hasOwn(value, "bytes_base64")));
  await getDb().prepare("UPDATE shop_settings SET enabled=0 WHERE id=1").run();
  assert.equal(await readShopImage(upload.id), null, "closing the shop revokes the public picture immediately");
  assert.ok(await readShopImage(upload.id, adminId));
  await getDb().prepare("UPDATE users SET role='student' WHERE id=?").run(adminId);
  assert.equal(await readShopImage(upload.id, adminId), null, "stale admin IDs must not see private pictures");
  await assert.rejects(saveShopImage(adminId, await png(400)), /behörighet/);
  await getDb().prepare("UPDATE users SET role='admin' WHERE id=?").run(adminId);
});

test("non-images, empty uploads, decompression bombs and oversized bodies are rejected without storage", async () => {
  const before = Number((await getDb().prepare("SELECT COUNT(*) count FROM shop_images").get())!.count);
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(SHOP_IMAGE_LIMIT + 1), Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), Buffer.from("fake PNG header")]) {
    await assert.rejects(saveShopImage(adminId, bytes));
  }
  const huge = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: "#476556" } }).png().toBuffer();
  assert.ok(huge.length < SHOP_IMAGE_LIMIT);
  await assert.rejects(saveShopImage(adminId, huge), /giltig/);
  assert.equal(Number((await getDb().prepare("SELECT COUNT(*) count FROM shop_images").get())!.count), before);
  assert.equal(await readShopImage("../../private"), null);
  await assert.rejects(saveShopImage(studentId, await png(400)), /behörighet/);
});

test("revoking an admin between authorization and reading image bytes blocks private access", async () => {
  const upload = await saveShopImage(adminId, await png(300));
  const db = getDb();
  const original = db.prepare.bind(db);
  let revoked = false;
  const intercepted = mock.method(db, "prepare", (sql: string) => {
    const statement = original(sql);
    if (!sql.startsWith("SELECT bytes_base64 FROM shop_images")) return statement;
    return { ...statement, get: async (...args: Parameters<typeof statement.get>) => {
      revoked = true;
      await original("UPDATE users SET role='student' WHERE id=?").run(adminId);
      return statement.get(...args);
    } };
  });
  try {
    assert.equal(await readShopImage(upload.id, adminId), null);
    assert.equal(revoked, true);
  } finally {
    intercepted.mock.restore();
    await original("UPDATE users SET role='admin' WHERE id=?").run(adminId);
  }
});

test("a bundle picture stays private until every component is public, including revocation during its read", async () => {
  const upload = await saveShopImage(adminId, await png(300));
  const component = await saveShopProduct(adminId, null, { name: "Bundle component", slug: "bundle-image-component", description: "", priceOre: 10000, vatPercent: 25, stock: 3, published: true, imageId: null });
  const bundle = await saveShopProduct(adminId, null, { name: "Bundle picture", slug: "bundle-image-test", description: "", priceOre: 10000, vatPercent: 25, stock: 0, published: true, imageId: upload.id });
  await getDb().prepare("UPDATE shop_products SET kind='bundle' WHERE id=?").run(bundle);
  await getDb().prepare("UPDATE shop_settings SET enabled=1 WHERE id=1").run();
  assert.equal(await readShopImage(upload.id), null, "empty bundles must not expose pictures");
  await getDb().prepare("INSERT INTO shop_bundle_items(bundle_id,product_id,quantity) VALUES(?,?,1)").run(bundle, component);
  assert.ok(await readShopImage(upload.id));
  await getDb().prepare("UPDATE shop_products SET vat_percent=12 WHERE id=?").run(component);
  assert.equal(await readShopImage(upload.id), null, "a mismatched VAT bundle is not a public product");
  await getDb().prepare("UPDATE shop_products SET vat_percent=25 WHERE id=?").run(component);
  await getDb().prepare("UPDATE shop_products SET published=0 WHERE id=?").run(component);
  assert.equal(await readShopImage(upload.id), null);
  assert.ok(await readShopImage(upload.id, adminId));
  assert.equal((await getPublicShopProducts()).some(item => item.id === bundle), false);
  await getDb().prepare("UPDATE shop_products SET published=1 WHERE id=?").run(component);
  const database = getDb();
  const original = database.prepare.bind(database);
  const intercepted = mock.method(database, "prepare", (sql: string) => {
    const statement = original(sql);
    if (!sql.startsWith("SELECT bytes_base64 FROM shop_images")) return statement;
    return { ...statement, get: async (...args: Parameters<typeof statement.get>) => {
      await original("UPDATE shop_products SET published=0 WHERE id=?").run(component);
      return statement.get(...args);
    } };
  });
  try {
    assert.equal(await readShopImage(upload.id), null, "the visibility check belongs to the same SQL read as the bytes");
  } finally {
    intercepted.mock.restore();
    await original("UPDATE shop_settings SET enabled=0 WHERE id=1").run();
  }
});
