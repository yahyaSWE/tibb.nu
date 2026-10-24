import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@libsql/client/node";
import { DatabaseAdapter } from "../src/lib/database";
import { SCHEMA, SCHEMA_VERSION } from "../src/lib/schema";
for(const key of ["TURSO_DATABASE_URL","TURSO_AUTH_TOKEN","VERCEL"]) delete process.env[key];

test("version 12 gains onsite defaults without changing treatment or booking history, and repeat initialization preserves remote links",async()=>{
  const client=createClient({url:"file::memory:",intMode:"number",concurrency:1});
  const adapter=new DatabaseAdapter();Object.assign(adapter,{clientPromise:Promise.resolve(client)});
  try{
    await client.executeMultiple(SCHEMA);
    await client.executeMultiple(`
      INSERT INTO app_meta(key,value) VALUES('seeded','1'),('schema_version','12');
      INSERT INTO treatments(id,name,duration_minutes,price_ore) VALUES(1,'Legacy onsite visit',30,39900);
      INSERT INTO slots(id,treatment_id,start,end) VALUES(1,1,'2090-01-01T10:00:00.000Z','2090-01-01T10:30:00.000Z');
      INSERT INTO bookings(id,reference,treatment_id,slot_id,treatment_name,duration_minutes,price_ore,start,end,name,email,status,payment_method,created_at)
      VALUES(1,'existing-reference',1,1,'Original name',30,34900,'2090-01-01T10:00:00.000Z','2090-01-01T10:30:00.000Z','Synthetic Customer','legacy@example.test','confirmed','onsite','2025-01-01T00:00:00.000Z');
    `);
    const treatment={...(await client.execute("SELECT * FROM treatments WHERE id=1")).rows[0]};
    const booking={...(await client.execute("SELECT * FROM bookings WHERE id=1")).rows[0]};
    await Promise.all([adapter.initialize(),adapter.initialize()]);
    assert.deepEqual((await client.execute("SELECT * FROM treatments WHERE id=1")).rows[0],{...treatment,delivery_mode:"onsite"});
    assert.deepEqual((await client.execute("SELECT * FROM bookings WHERE id=1")).rows[0],{...booking,delivery_mode:"onsite",meeting_url:""});
    assert.equal(Number((await client.execute("PRAGMA user_version")).rows[0].user_version),SCHEMA_VERSION);
    await assert.rejects(client.execute("UPDATE treatments SET delivery_mode='invalid' WHERE id=1"));
    await client.execute("UPDATE bookings SET delivery_mode='remote',meeting_url='https://meeting.example.test/preserved' WHERE id=1");
    const cold=new DatabaseAdapter();Object.assign(cold,{clientPromise:Promise.resolve(client)});await cold.initialize();
    assert.equal((await client.execute("SELECT meeting_url FROM bookings WHERE id=1")).rows[0].meeting_url,"https://meeting.example.test/preserved");
  }finally{await adapter.close();}
});
