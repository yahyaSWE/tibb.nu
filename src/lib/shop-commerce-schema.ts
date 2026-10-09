export const SHOP_COMMERCE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS shop_bundle_items (
    bundle_id INTEGER NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES shop_products(id),
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
    PRIMARY KEY(bundle_id,product_id), CHECK(bundle_id!=product_id)
  );
  CREATE INDEX IF NOT EXISTS shop_bundle_component ON shop_bundle_items(product_id,bundle_id);
  CREATE TABLE IF NOT EXISTS shop_quantity_offers (
    id INTEGER PRIMARY KEY,name TEXT NOT NULL,scope TEXT NOT NULL CHECK(scope IN ('per_product','mixed')),
    product_ids_json TEXT NOT NULL DEFAULT '[]',min_quantity INTEGER NOT NULL CHECK(min_quantity BETWEEN 2 AND 10000),
    percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 99),active INTEGER NOT NULL CHECK(active IN (0,1))
  );
  CREATE TABLE IF NOT EXISTS shop_coupons (
    id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('percent','fixed')),
    value INTEGER NOT NULL CHECK(value BETWEEN 1 AND 10000000),min_subtotal_ore INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL CHECK(active IN (0,1)),starts_at TEXT,ends_at TEXT,max_uses INTEGER,
    combine_with_offers INTEGER NOT NULL CHECK(combine_with_offers IN (0,1))
  );
  CREATE TABLE IF NOT EXISTS shop_coupon_uses (
    order_id INTEGER PRIMARY KEY REFERENCES shop_orders(id),coupon_id INTEGER NOT NULL REFERENCES shop_coupons(id),
    state TEXT NOT NULL CHECK(state IN ('reserved','paid','released'))
  );
  CREATE INDEX IF NOT EXISTS shop_coupon_capacity ON shop_coupon_uses(coupon_id,state);
  CREATE TABLE IF NOT EXISTS shop_shipping_rules (
    id INTEGER PRIMARY KEY,name TEXT NOT NULL,carrier TEXT NOT NULL DEFAULT '',service TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL CHECK(active IN (0,1)),priority INTEGER NOT NULL DEFAULT 0,
    min_weight_grams INTEGER NOT NULL DEFAULT 0,max_weight_grams INTEGER,
    min_subtotal_ore INTEGER NOT NULL DEFAULT 0,max_subtotal_ore INTEGER,
    postcode_prefixes_json TEXT NOT NULL DEFAULT '[]',price_ore INTEGER NOT NULL CHECK(price_ore BETWEEN 0 AND 1000000)
  );
  CREATE TRIGGER IF NOT EXISTS shop_bundle_insert_reference BEFORE INSERT ON shop_bundle_items
    WHEN NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.bundle_id AND kind='bundle')
      OR NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.product_id AND kind='product')
    BEGIN SELECT RAISE(ABORT,'Invalid bundle reference'); END;
  CREATE TRIGGER IF NOT EXISTS shop_bundle_update_reference BEFORE UPDATE ON shop_bundle_items
    WHEN NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.bundle_id AND kind='bundle')
      OR NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.product_id AND kind='product')
    BEGIN SELECT RAISE(ABORT,'Invalid bundle reference'); END;
  CREATE TRIGGER IF NOT EXISTS shop_coupon_use_reference BEFORE INSERT ON shop_coupon_uses
    WHEN NOT EXISTS(SELECT 1 FROM shop_orders WHERE id=NEW.order_id)
      OR NOT EXISTS(SELECT 1 FROM shop_coupons WHERE id=NEW.coupon_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS shop_products_bundle_cleanup BEFORE DELETE ON shop_products BEGIN
    DELETE FROM shop_bundle_items WHERE bundle_id=OLD.id OR product_id=OLD.id;
  END;
`;
