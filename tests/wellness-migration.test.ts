import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client/node";
import { DatabaseAdapter } from "../src/lib/database";
import { SCHEMA, SCHEMA_VERSION } from "../src/lib/schema";
import { SHOP_SCHEMA } from "../src/lib/shop-schema";
import { SHOP_IMAGE_SCHEMA } from "../src/lib/shop-image-schema";
for(const key of ["TURSO_DATABASE_URL","TURSO_AUTH_TOKEN","VERCEL"]) delete process.env[key];
test("schema 14 adds wellness privately without publishing services or changing products/order history",async()=>{
  const client=createClient({url:"file::memory:",intMode:"number",concurrency:1});
  const adapter=new DatabaseAdapter();Object.assign(adapter,{clientPromise:Promise.resolve(client)});
  try{
    await client.executeMultiple(SCHEMA);await client.executeMultiple(SHOP_IMAGE_SCHEMA);await client.executeMultiple(SHOP_SCHEMA);
    await client.executeMultiple(`
      INSERT INTO app_meta(key,value) VALUES('seeded','1'),('schema_version','14');
      PRAGMA user_version=14;
      INSERT INTO shop_products(id,name,slug,price_ore,stock,published,created_at,updated_at) VALUES(1,'Original product','original',9900,4,1,'2026-01-01','2026-01-01');
      INSERT INTO shop_orders(id,reference,name,email,delivery,subtotal_ore,shipping_ore,total_ore,expires_at,created_at,items_json,terms) VALUES(1,'legacy-order','Synthetic Customer','test@example.test','pickup',9900,0,9900,'2026-01-01','2026-01-01','[]','Original terms');
    `);
    const product={...(await client.execute("SELECT * FROM shop_products WHERE id=1")).rows[0]};
    const order={...(await client.execute("SELECT * FROM shop_orders WHERE id=1")).rows[0]};
    await Promise.all([adapter.initialize(),adapter.initialize()]);
    const actual=(await client.execute("SELECT * FROM shop_products WHERE id=1")).rows[0];
    for(const [key,value] of Object.entries(product)) assert.equal(actual[key],value);
    assert.equal(actual.is_service,0);assert.equal(actual.wellness_eligible,0);assert.equal(actual.validity_months,12);
    const migratedOrder=(await client.execute("SELECT * FROM shop_orders WHERE id=1")).rows[0];
    for(const [key,value] of Object.entries(order))assert.equal(migratedOrder[key],value);
    assert.equal((await client.execute("SELECT COUNT(*) total FROM wellness_receipts")).rows[0].total,0);
    assert.equal(Number((await client.execute("PRAGMA user_version")).rows[0].user_version),SCHEMA_VERSION);
    await assert.rejects(client.execute("UPDATE shop_products SET wellness_eligible=1 WHERE id=1"));
    const cold=new DatabaseAdapter();Object.assign(cold,{clientPromise:Promise.resolve(client)});await cold.initialize();
    assert.equal((await client.execute("SELECT COUNT(*) total FROM shop_products")).rows[0].total,1);
  }finally{await adapter.close();}
});
