export const SHOP_IMAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS shop_images (
  id TEXT PRIMARY KEY,
  bytes_base64 TEXT NOT NULL CHECK(length(bytes_base64) BETWEEN 1 AND 2800000),
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS shop_images_user_reference BEFORE INSERT ON shop_images
  WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.uploader_id AND role='admin')
  BEGIN SELECT RAISE(ABORT,'Administrator required'); END;
`;
