export const SHOP_PRODUCT_CONTENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS shop_product_content_images (
    product_id INTEGER NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
    image_id TEXT NOT NULL REFERENCES shop_images(id) ON DELETE CASCADE,
    PRIMARY KEY(product_id,image_id)
  );
  CREATE INDEX IF NOT EXISTS shop_product_content_image ON shop_product_content_images(image_id,product_id);
  CREATE TRIGGER IF NOT EXISTS shop_product_content_insert_reference BEFORE INSERT ON shop_product_content_images
    WHEN NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.product_id)
      OR NOT EXISTS(SELECT 1 FROM shop_images WHERE id=NEW.image_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS shop_product_content_update_reference BEFORE UPDATE ON shop_product_content_images
    WHEN NOT EXISTS(SELECT 1 FROM shop_products WHERE id=NEW.product_id)
      OR NOT EXISTS(SELECT 1 FROM shop_images WHERE id=NEW.image_id)
    BEGIN SELECT RAISE(ABORT,'Foreign key constraint failed'); END;
  CREATE TRIGGER IF NOT EXISTS shop_products_content_cleanup BEFORE DELETE ON shop_products BEGIN
    DELETE FROM shop_product_content_images WHERE product_id=OLD.id;
  END;
  CREATE TRIGGER IF NOT EXISTS shop_images_content_cleanup BEFORE DELETE ON shop_images BEGIN
    DELETE FROM shop_product_content_images WHERE image_id=OLD.id;
  END;
`;
