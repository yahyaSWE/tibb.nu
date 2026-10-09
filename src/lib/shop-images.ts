import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { assertAdmin } from "./admin";
import { getDb, transaction, DomainError } from "./db";

export const SHOP_IMAGE_LIMIT = 2 * 1024 * 1024;
const IMAGE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export async function saveShopImage(actorId: number, bytes: Buffer) {
  await assertAdmin(actorId);
  if (!bytes.length || bytes.length > SHOP_IMAGE_LIMIT) throw new DomainError("Bilden får vara högst 2 MB.");
  let stored: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format) || (meta.pages ?? 1) > 1)
      throw new Error("Unsupported image");
    stored = await image.rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    if (!stored.length || stored.length > SHOP_IMAGE_LIMIT) throw new Error("Image too large");
  } catch { throw new DomainError("Välj en giltig JPG-, PNG- eller WebP-bild på högst 2 MB."); }
  const id = randomUUID();
  await transaction(async () => {
    await assertAdmin(actorId);
    await getDb().prepare("INSERT INTO shop_images(id,bytes_base64,uploader_id,created_at) VALUES(?,?,?,?)")
      .run(id, stored.toString("base64"), actorId, new Date().toISOString());
  });
  return { id, url: `/api/shop/images/${id}` };
}

export async function readShopImage(id: string, actorId?: number): Promise<Buffer | null> {
  if (!IMAGE_ID.test(id)) return null;
  let administrator = false;
  if (actorId) { try { await assertAdmin(actorId); administrator = true; } catch { /* Public visibility still applies. */ } }
  const row = administrator
    ? await getDb().prepare("SELECT bytes_base64 FROM shop_images WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND role='admin')").get(id, actorId!)
    : await getDb().prepare(`SELECT bytes_base64 FROM shop_images WHERE id=?
        AND EXISTS(SELECT 1 FROM shop_settings WHERE enabled=1)
        AND EXISTS(SELECT 1 FROM shop_products p WHERE p.image_id=shop_images.id AND p.published=1
          AND (p.kind='product' OR (p.kind='bundle'
            AND EXISTS(SELECT 1 FROM shop_bundle_items b WHERE b.bundle_id=p.id)
            AND NOT EXISTS(SELECT 1 FROM shop_bundle_items b LEFT JOIN shop_products component ON component.id=b.product_id
              WHERE b.bundle_id=p.id AND (component.id IS NULL OR component.published!=1 OR component.kind!='product' OR component.vat_percent!=p.vat_percent)))))`).get(id);
  return row ? Buffer.from(String(row.bytes_base64), "base64") : null;
}
