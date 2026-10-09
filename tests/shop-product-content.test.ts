import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client/node";
import { DatabaseAdapter } from "../src/lib/database";
import { SCHEMA_VERSION } from "../src/lib/schema";
import { createFirstAdmin, createUser, DomainError, getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/security";
import { getAdminShopProduct, getPublicShopProduct, quoteShopCart, saveShopProduct } from "../src/lib/shop";
import { readShopImage } from "../src/lib/shop-images";
import { shopProductFields } from "../src/lib/shop-admin-state";
import { parseProductRichText, type ProductRichTextDocument } from "../src/lib/product-rich-text";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "STRIPE_SECRET_KEY", "SHOP_STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
let adminId: number, studentId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({ name: "Product content admin", email: "content-admin@example.test", passwordHash: hashPassword("isolated product content fixture password") })).id;
  studentId = (await createUser({ name: "Product content student", email: "content-student@example.test", passwordHash: hashPassword("isolated product content student password"), role: "student" })).id;
});
beforeEach(async () => {
  await getDb().exec("DELETE FROM shop_product_content_images; DELETE FROM shop_bundle_items; DELETE FROM shop_products; DELETE FROM shop_images;");
  await getDb().prepare("UPDATE shop_settings SET enabled=1,pickup_enabled=1,shipping_enabled=0,terms='Isolated fixture terms' WHERE id=1").run();
  await getDb().prepare("UPDATE users SET role='admin' WHERE id=?").run(adminId);
});
after(async () => { await getDb().close(); });
function document(imageIds: string[] = [], wording = "Fördjupad produktinformation"): ProductRichTextDocument {
  return { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Användning" }] },
    { type: "paragraph", content: [{ type: "text", text: wording, marks: [{ type: "bold" }] }] },
    ...imageIds.map(id => ({ type: "image" as const, attrs: { src: `/api/shop/images/${id}`, alt: "Produktdetalj", title: "Bildtext" } })),
  ] };
}
async function image() {
  const id = randomUUID();
  await getDb().prepare("INSERT INTO shop_images(id,bytes_base64,uploader_id,created_at) VALUES(?,?,?,?)").run(id, Buffer.from(`isolated image ${id}`).toString("base64"), adminId, new Date().toISOString());
  return id;
}
async function product(overrides: Partial<Parameters<typeof saveShopProduct>[2]> = {}) {
  return saveShopProduct(adminId, null, { name: "Content fixture", slug: `content-${++sequence}`, description: "Kort produktbeskrivning", priceOre: 12900, vatPercent: 25, stock: 8, published: true, imageId: null, ...overrides });
}
async function current(id: number) { return (await getAdminShopProduct(adminId, id))!; }
async function edit(id: number, overrides: Partial<Parameters<typeof saveShopProduct>[2]> = {}) {
  const value = await current(id);
  return saveShopProduct(adminId, id, { ...value, expectedUpdatedAt: value.updatedAt, ...overrides });
}
async function references(id: number) {
  return (await getDb().prepare("SELECT image_id FROM shop_product_content_images WHERE product_id=? ORDER BY image_id").all(id)).map(row => String(row.image_id));
}

test("optional rich descriptions save and read independently of short descriptions, catalog prices and quote fingerprints", async () => {
  const legacy = await product();
  assert.equal((await current(legacy)).richDescription, null);
  const pictures = [await image(), await image()];
  const rich = document(pictures);
  const id = await product({ richDescription: JSON.stringify(rich) });
  const saved = await current(id);
  assert.deepEqual(saved.richDescription, parseProductRichText(rich));
  assert.equal(saved.description, "Kort produktbeskrivning");
  assert.equal(saved.priceOre, 12900);
  assert.deepEqual(await references(id), pictures.toSorted());
  assert.deepEqual((await getPublicShopProduct(saved.slug))!.richDescription, saved.richDescription);
  const quoteInput = { items: [{ productId: id, quantity: 1 }], delivery: "pickup" as const };
  const originalQuote = await quoteShopCart(quoteInput);
  await edit(id, { richDescription: document(pictures, "Ändrad fördjupning som inte påverkar priset") });
  assert.deepEqual(await quoteShopCart(quoteInput), originalQuote);
  assert.equal(Object.hasOwn(originalQuote.items[0], "richDescription"), false);
});

test("omitted rich-description input preserves existing content and an explicit empty input clears document and references", async () => {
  const picture = await image();
  const id = await product({ richDescription: document([picture]) });
  const value = await current(id);
  const { richDescription, ...legacyInput } = value;
  await saveShopProduct(adminId, id, { ...legacyInput, name: "Legacy edit", expectedUpdatedAt: value.updatedAt });
  assert.deepEqual((await current(id)).richDescription, richDescription);
  assert.deepEqual(await references(id), [picture]);
  assert.ok(await readShopImage(picture));
  await edit(id, { richDescription: "" });
  assert.equal((await current(id)).richDescription, null);
  assert.deepEqual(await references(id), []);
  assert.equal(await readShopImage(picture), null);
  assert.ok(await readShopImage(picture, adminId));
});

test("forged document/image content, absent later images and unauthorized saves cannot modify product state", async () => {
  const picture = await image();
  const id = await product({ richDescription: document([picture]) });
  const snapshot = await current(id);
  const originalRefs = await references(id);
  for (const content of ["<script>private forged detail</script>", { type: "doc", content: [{ type: "html", html: "<script>private forged detail</script>" }] }, { type: "doc", content: [{ type: "image", attrs: { src: "https://external.example.test/private.jpg", alt: "Private forged detail" } }] }]) {
    await assert.rejects(edit(id, { name: "Should not save", richDescription: content }), error => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.message.includes("private forged detail"), false);
      return true;
    });
  }
  await assert.rejects(edit(id, { richDescription: document([picture, randomUUID()]) }), /uppladdade bilder/);
  for (const [content, expected] of [
    [{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(50_001) }] }] }, /högst 50 000 tecken/],
    [document(Array.from({ length: 21 }, () => randomUUID())), /högst 20 olika bilder/],
  ] as const) {
    await assert.rejects(edit(id, { name: "Bounded input must not save", richDescription: content }), error => {
      assert.ok(error instanceof DomainError);
      assert.match(error.message, expected);
      return true;
    });
    assert.deepEqual(await current(id), snapshot);
    assert.deepEqual(await references(id), originalRefs);
  }
  await assert.rejects(product({ richDescription: document([picture, randomUUID()]) }), /uppladdade bilder/);
  assert.equal(Number((await getDb().prepare("SELECT COUNT(*) total FROM shop_products").get())!.total), 1);
  await assert.rejects(saveShopProduct(studentId, id, { ...snapshot, richDescription: "", expectedUpdatedAt: snapshot.updatedAt }), /behörighet/);
  assert.deepEqual(await current(id), snapshot);
  assert.deepEqual(await references(id), originalRefs);
});

test("CAS failures and interrupted many-image replacement retain saved content while form snapshots keep raw failed input", async () => {
  const originalPicture = await image(), replacement = [await image(), await image()];
  const id = await product({ richDescription: document([originalPicture]) });
  const stale = await current(id);
  await edit(id, { name: "Saved elsewhere" });
  const saved = await current(id);
  await assert.rejects(saveShopProduct(adminId, id, { ...stale, richDescription: document(replacement), expectedUpdatedAt: stale.updatedAt }), /ändrats/);
  assert.deepEqual(await current(id), saved);
  assert.deepEqual(await references(id), [originalPicture]);
  const db = getDb(), originalPrepare = db.prepare.bind(db);
  let insertions = 0;
  const interrupted = mock.method(db, "prepare", (sql: string) => {
    const statement = originalPrepare(sql);
    if (!sql.startsWith("INSERT INTO shop_product_content_images")) return statement;
    return { ...statement, run: async (...args: Parameters<typeof statement.run>) => {
      if (++insertions === 2) throw new Error("isolated image reference interruption");
      return statement.run(...args);
    } };
  });
  try { await assert.rejects(edit(id, { name: "Uncommitted", richDescription: document(replacement) }), /interruption/); }
  finally { interrupted.mock.restore(); }
  assert.deepEqual(await current(id), saved);
  assert.deepEqual(await references(id), [originalPicture]);
  const raw = '  { "type": "doc", "content": [ broken input  ';
  const form = new FormData();
  form.set("richDescription", raw);
  form.set("name", "  Unsaved name  ");
  form.set("price", "129,01");
  form.set("expectedUpdatedAt", stale.updatedAt);
  const fields = shopProductFields(form);
  assert.equal(fields.richDescription, raw);
  assert.equal(fields.name, "  Unsaved name  ");
  assert.equal(fields.price, "129,01");
  assert.equal(fields.expectedUpdatedAt, stale.updatedAt);
});

test("all rich images require live publication and store access, with immediate reference and admin revocation", async () => {
  const pictures = [await image(), await image()];
  const id = await product({ richDescription: document(pictures), published: false });
  for (const picture of pictures) { assert.equal(await readShopImage(picture), null); assert.ok(await readShopImage(picture, adminId)); }
  await edit(id, { published: true });
  for (const picture of pictures) assert.ok(await readShopImage(picture));
  await edit(id, { richDescription: document([pictures[1]]) });
  assert.equal(await readShopImage(pictures[0]), null);
  assert.ok(await readShopImage(pictures[1]));
  await getDb().prepare("UPDATE shop_settings SET enabled=0 WHERE id=1").run();
  assert.equal(await readShopImage(pictures[1]), null);
  assert.ok(await readShopImage(pictures[1], adminId));
  await getDb().prepare("UPDATE users SET role='student' WHERE id=?").run(adminId);
  assert.equal(await readShopImage(pictures[1], adminId), null);
  await assert.rejects(edit(id, { richDescription: "" }), /behörighet/);
});

test("public rich-image byte reads observe reference removal and publication/store changes within the same SQL query", async () => {
  const picture = await image();
  const id = await product({ richDescription: document([picture]) });
  const db = getDb(), originalPrepare = db.prepare.bind(db);
  for (const revoke of [
    () => originalPrepare("UPDATE shop_settings SET enabled=0 WHERE id=1").run(),
    () => originalPrepare("UPDATE shop_products SET published=0 WHERE id=?").run(id),
    () => originalPrepare("DELETE FROM shop_product_content_images WHERE product_id=?").run(id),
  ]) {
    const intercepted = mock.method(db, "prepare", (sql: string) => {
      const statement = originalPrepare(sql);
      if (!sql.startsWith("SELECT bytes_base64 FROM shop_images")) return statement;
      return { ...statement, get: async (...args: Parameters<typeof statement.get>) => { await revoke(); return statement.get(...args); } };
    });
    try { assert.equal(await readShopImage(picture), null); }
    finally { intercepted.mock.restore(); }
    await originalPrepare("UPDATE shop_settings SET enabled=1 WHERE id=1").run();
    await originalPrepare("UPDATE shop_products SET published=1 WHERE id=?").run(id);
    await originalPrepare("INSERT OR IGNORE INTO shop_product_content_images(product_id,image_id) VALUES(?,?)").run(id, picture);
    assert.ok(await readShopImage(picture));
  }
});

test("rich images of bundles require every component's publication, kind, VAT and a nonempty composition", async () => {
  const pictures = [await image(), await image()];
  const component = await product();
  const bundle = await product({ kind: "bundle", bundleItems: [{ productId: component, quantity: 2 }], richDescription: document(pictures) });
  for (const picture of pictures) assert.ok(await readShopImage(picture));
  for (const invalid of [{ published: 0 }, { vat_percent: 12 }, { kind: "bundle" }]) {
    const [column, value] = Object.entries(invalid)[0];
    await getDb().prepare(`UPDATE shop_products SET ${column}=? WHERE id=?`).run(value, component);
    for (const picture of pictures) assert.equal(await readShopImage(picture), null);
    await getDb().prepare("UPDATE shop_products SET published=1,vat_percent=25,kind='product' WHERE id=?").run(component);
  }
  await getDb().prepare("DELETE FROM shop_bundle_items WHERE bundle_id=?").run(bundle);
  for (const picture of pictures) assert.equal(await readShopImage(picture), null);
  await getDb().prepare("DELETE FROM shop_products WHERE id=?").run(bundle);
  assert.deepEqual(await references(bundle), []);
});

test("version 6 migration atomically adds optional product content while preserving products, images and commerce snapshots", async () => {
  const client = createClient({ url: "file::memory:", intMode: "number", concurrency: 1 });
  const initial = new DatabaseAdapter();
  Object.assign(initial, { clientPromise: Promise.resolve(client) });
  try {
    await initial.initialize();
    await client.executeMultiple(`
      INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(90,'legacy-content@example.test','Legacy admin','isolated-hash','admin','2025-01-01T00:00:00.000Z');
      INSERT INTO shop_images(id,bytes_base64,uploader_id,created_at) VALUES('07cf9f34-0571-46dd-8498-5fc5adb93785','aXNvbGF0ZWQ=',90,'2025-01-01T00:00:00.000Z');
      UPDATE shop_settings SET enabled=1,shipping_price_ore=6900,packing_weight_grams=40,terms='Original commerce terms' WHERE id=1;
      INSERT INTO shop_products(id,name,slug,description,price_ore,stock,published,image_id,created_at,updated_at,kind,weight_grams) VALUES(1,'Existing product','existing-content-product','Existing short description',12900,4,1,'07cf9f34-0571-46dd-8498-5fc5adb93785','2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z','product',200),(2,'Existing bundle','existing-content-bundle','Existing bundle description',22900,0,1,NULL,'2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z','bundle',0);
      INSERT INTO shop_bundle_items VALUES(2,1,2);
      INSERT INTO shop_quantity_offers VALUES(1,'Original offer','per_product','[1]',3,10,1);
      INSERT INTO shop_coupons VALUES(1,'ORIGINAL','Original coupon','percent',10,10000,1,NULL,NULL,5,1);
      INSERT INTO shop_shipping_rules VALUES(1,'Original shipping','Carrier','Service',1,0,0,1000,0,NULL,'["12"]',6900);
      INSERT INTO shop_orders(id,reference,name,email,delivery,subtotal_ore,shipping_ore,total_ore,expires_at,created_at,items_json,terms,inventory_json,original_subtotal_ore,discount_ore,discounts_json,coupon_code)
      VALUES(1,'existing-content-order','Original customer','buyer@example.test','shipping',20000,6900,26900,'2090-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z','[{"productId":2,"name":"Original bundle","priceOre":22900,"vatPercent":25,"quantity":1}]','Original purchase terms','[{"productId":1,"quantity":2}]',22900,2900,'[{"kind":"coupon","name":"Original coupon","amountOre":2900}]','ORIGINAL');
      INSERT INTO shop_coupon_uses VALUES(1,1,'reserved');
      DROP TRIGGER shop_product_content_insert_reference;
      DROP TRIGGER shop_product_content_update_reference;
      DROP TRIGGER shop_products_content_cleanup;
      DROP TRIGGER shop_images_content_cleanup;
      DROP TABLE shop_product_content_images;
      ALTER TABLE shop_products DROP COLUMN rich_description_json;
      UPDATE app_meta SET value='6' WHERE key='schema_version';
      PRAGMA user_version=6;
    `);
    const tables = ["users", "settings", "shop_settings", "shop_products", "shop_images", "shop_orders", "shop_bundle_items", "shop_coupons", "shop_coupon_uses", "shop_quantity_offers", "shop_shipping_rules"];
    const snapshots = new Map<string, Record<string, unknown>[]>();
    for (const table of tables) snapshots.set(table, (await client.execute(`SELECT * FROM ${table} ORDER BY 1`)).rows);
    let fail = true;
    const wrapped = new Proxy(client, { get(target, key) {
      if (key === "transaction") return async (mode: "write" | "read" | "deferred") => {
        const tx = await target.transaction(mode);
        return new Proxy(tx, { get(transaction, property) {
          if (property === "executeMultiple") return async (sql: string) => {
            await transaction.executeMultiple(sql);
            if (fail && sql.includes("CREATE TABLE IF NOT EXISTS shop_product_content_images")) { fail = false; throw new Error("isolated content migration interruption"); }
          };
          const value = Reflect.get(transaction, property);
          return typeof value === "function" ? value.bind(transaction) : value;
        } });
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    const migrated = new DatabaseAdapter();
    Object.assign(migrated, { clientPromise: Promise.resolve(wrapped) });
    await assert.rejects(migrated.initialize(), /migration interruption/);
    assert.equal((await client.execute("PRAGMA user_version")).rows[0].user_version, 6);
    assert.equal((await client.execute("SELECT value FROM app_meta WHERE key='schema_version'")).rows[0].value, "6");
    assert.equal((await client.execute("PRAGMA table_info(shop_products)")).rows.some(row => row.name === "rich_description_json"), false);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM sqlite_master WHERE name='shop_product_content_images'")).rows[0].total, 0);
    await migrated.initialize();
    for (const table of tables) {
      const oldRows = snapshots.get(table)!;
      const rows = (await client.execute(`SELECT * FROM ${table} ORDER BY 1`)).rows;
      assert.equal(rows.length, oldRows.length);
      for (let index = 0; index < rows.length; index++) for (const [key, value] of Object.entries(oldRows[index])) assert.deepEqual(rows[index][key], value, `${table}.${key}`);
    }
    assert.equal((await client.execute("PRAGMA user_version")).rows[0].user_version, SCHEMA_VERSION);
    assert.equal((await client.execute("SELECT value FROM app_meta WHERE key='schema_version'")).rows[0].value, String(SCHEMA_VERSION));
    assert.equal((await client.execute("SELECT COUNT(*) total FROM shop_products WHERE rich_description_json IS NULL")).rows[0].total, 2);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM shop_product_content_images")).rows[0].total, 0);
    const cold = new DatabaseAdapter();
    Object.assign(cold, { clientPromise: Promise.resolve(new Proxy(client, { get(target, key) {
      if (key === "transaction") return () => { throw new Error("Current schema must skip migration"); };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } })) });
    await cold.initialize();
  } finally { await initial.close(); }
});
