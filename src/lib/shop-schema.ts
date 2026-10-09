export const SHOP_SCHEMA = `
  CREATE TABLE IF NOT EXISTS shop_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
    shipping_enabled INTEGER NOT NULL DEFAULT 1 CHECK(shipping_enabled IN (0,1)),
    pickup_enabled INTEGER NOT NULL DEFAULT 1 CHECK(pickup_enabled IN (0,1)),
    shipping_price_ore INTEGER NOT NULL DEFAULT 0 CHECK(shipping_price_ore BETWEEN 0 AND 1000000),
    free_shipping_threshold_ore INTEGER CHECK(free_shipping_threshold_ore BETWEEN 0 AND 100000000),
    pickup_address TEXT NOT NULL DEFAULT '', pickup_instructions TEXT NOT NULL DEFAULT '', terms TEXT NOT NULL DEFAULT ''
  );
  INSERT OR IGNORE INTO shop_settings(id) VALUES(1);
  CREATE TABLE IF NOT EXISTS shop_products (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '', price_ore INTEGER NOT NULL CHECK(price_ore BETWEEN 1 AND 10000000),
    vat_percent INTEGER NOT NULL DEFAULT 25 CHECK(vat_percent IN (0,6,12,25)),
    stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),
    published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
    image_id TEXT REFERENCES shop_images(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shop_products_public ON shop_products(published,name,id);
  CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '', delivery TEXT NOT NULL CHECK(delivery IN ('shipping','pickup')),
    address TEXT NOT NULL DEFAULT '', postcode TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '',
    subtotal_ore INTEGER NOT NULL CHECK(subtotal_ore>0), shipping_ore INTEGER NOT NULL CHECK(shipping_ore>=0),
    total_ore INTEGER NOT NULL CHECK(total_ore=subtotal_ore+shipping_ore AND total_ore<=100000000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','refunded')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid','refund_pending','refunded')),
    fulfillment TEXT NOT NULL DEFAULT 'unfulfilled' CHECK(fulfillment IN ('unfulfilled','ready','shipped','collected')),
    tracking_number TEXT NOT NULL DEFAULT '', checkout_session_id TEXT UNIQUE,
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT,
    items_json TEXT NOT NULL, pickup_address TEXT NOT NULL DEFAULT '', pickup_instructions TEXT NOT NULL DEFAULT '',
    terms TEXT NOT NULL, inventory_released INTEGER NOT NULL DEFAULT 0 CHECK(inventory_released IN (0,1))
  );
  CREATE INDEX IF NOT EXISTS shop_orders_expiry ON shop_orders(status,expires_at);
  CREATE INDEX IF NOT EXISTS shop_orders_created ON shop_orders(created_at,id);
  CREATE TRIGGER IF NOT EXISTS shop_products_image_reference BEFORE INSERT ON shop_products
    WHEN NEW.image_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shop_images WHERE id=NEW.image_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS shop_products_image_update BEFORE UPDATE OF image_id ON shop_products
    WHEN NEW.image_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shop_images WHERE id=NEW.image_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS shop_images_products_cleanup BEFORE DELETE ON shop_images BEGIN
    UPDATE shop_products SET image_id=NULL WHERE image_id=OLD.id;
  END;
`;
