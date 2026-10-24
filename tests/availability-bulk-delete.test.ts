import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createFirstAdmin, createUser, getBookingById, getDb, getSlots, reserveBooking, transaction } from "../src/lib/db";
import { deleteSlots, updateBooking } from "../src/lib/admin";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "APP_URL"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
let adminId: number, studentId: number, treatmentId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({name:"Bulk Admin",email:"bulk-admin@example.test",passwordHash:"synthetic-admin-hash"})).id;
  studentId = (await createUser({name:"Bulk Student",email:"bulk-student@example.test",role:"student",passwordHash:"synthetic-student-hash"})).id;
  treatmentId = Number((await getDb().prepare("INSERT INTO treatments(name,duration_minutes,price_ore,active) VALUES('Synthetic visit',30,39900,1)").run()).lastInsertRowid);
});
beforeEach(async () => {
  await getDb().prepare("DELETE FROM bookings").run();
  await getDb().prepare("DELETE FROM slots").run();
  await getDb().prepare("DELETE FROM availability_blocks").run();
  sequence = 0;
});
after(async () => {await getDb().close();});
async function slot(options: {past?: boolean;archived?: boolean} = {}) {
  const start = new Date(Date.now() + (options.past ? -30 : 30)*86400000 + (++sequence)*3600000).toISOString();
  const end = new Date(Date.parse(start)+30*60000).toISOString();
  const id = Number((await getDb().prepare("INSERT INTO slots(treatment_id,practitioner_id,start,end,archived) VALUES(?,1,?,?,?)").run(treatmentId,start,end,options.archived?1:0)).lastInsertRowid);
  return {id,start,end};
}
function reserve(slotId: number) {
  return reserveBooking({slotId,name:"Synthetic Customer",email:"bulk-customer@example.test",phone:"",paymentMethod:"onsite"});
}

test("bulk removal covers multiple SQL batches, preserves booked visits and history, and skips unavailable IDs",async()=>{
  const slots = await transaction(async()=>{
    const values=[];
    for(let index=0;index<430;index++) values.push(await slot());
    return values;
  });
  const booked=await Promise.all([reserve(slots[0].id),reserve(slots[60].id),reserve(slots[420].id)]);
  const archived=await slot({archived:true}),past=await slot({past:true});
  await getDb().prepare("INSERT INTO availability_blocks(practitioner_id,start,end,all_day,reason,created_at) VALUES(1,?,?,0,'Synthetic block',?)").run(slots[1].start,slots[1].end,new Date().toISOString());
  assert.equal((await getSlots({futureOnly:true,includeBlocked:true})).find(value=>value.id===slots[1].id)!.blocked,true);
  const ids=[...slots.map(value=>value.id),archived.id,past.id,999999];
  assert.deepEqual(await deleteSlots(adminId,[...ids,slots[2].id]),{removed:427,booked:3,unavailable:3});
  assert.equal((await getSlots({futureOnly:true,includeBlocked:true})).length,3);
  for(const booking of booked){
    assert.equal((await getBookingById(booking.id))!.status,"confirmed");
    assert.equal((await getDb().prepare("SELECT archived FROM slots WHERE id=?").get(booking.slotId))!.archived,0);
  }
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM slots").get())!.total,432);
  assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM availability_blocks").get())!.total,1);
  assert.deepEqual(await deleteSlots(adminId,ids),{removed:0,booked:3,unavailable:430});
});

test("authorization and invalid IDs reject the entire operation before any selected slot changes",async()=>{
  const value=await slot();
  await assert.rejects(deleteSlots(studentId,[value.id]),/behörighet/);
  for(const invalid of [[],[value.id,0],[value.id,-1],[value.id,1.5],[value.id,"2"],[value.id,NaN]])
    await assert.rejects(deleteSlots(adminId,invalid as number[]));
  assert.equal((await getDb().prepare("SELECT archived FROM slots WHERE id=?").get(value.id))!.archived,0);
});

test("a newly booked slot and overlapping availability are protected even when an old selection includes them",async()=>{
  const original=await slot(),unrelated=await slot();
  const selection=[original.id,unrelated.id];
  const booking=await reserve(original.id);
  // Legacy overlapping availability may point to a different slot ID. Its
  // occupied practitioner interval must still receive the same protection.
  const overlap=Number((await getDb().prepare("INSERT INTO slots(treatment_id,practitioner_id,start,end) VALUES(?,1,?,?)").run(treatmentId,original.start,original.end)).lastInsertRowid);
  assert.deepEqual(await deleteSlots(adminId,[...selection,overlap]),{removed:1,booked:2,unavailable:0});
  assert.equal((await getBookingById(booking.id))!.status,"confirmed");
  await updateBooking(adminId,booking.id,"cancelled","pending");
  assert.deepEqual(await deleteSlots(adminId,[original.id,overlap]),{removed:2,booked:0,unavailable:0});
  assert.equal((await getBookingById(booking.id))!.status,"cancelled");
});

test("concurrent reservation and removal leave either a protected booking or an unavailable slot, never a booking on an archived slot",async()=>{
  for(const removalFirst of [false,true]){
    const value=await slot();
    const outcomes=await Promise.allSettled(removalFirst
      ? [deleteSlots(adminId,[value.id]),reserve(value.id)]
      : [reserve(value.id),deleteSlots(adminId,[value.id])]);
    const booking=outcomes[removalFirst?1:0],removal=outcomes[removalFirst?0:1];
    assert.equal(removal.status,"fulfilled");
    const row=(await getDb().prepare("SELECT archived FROM slots WHERE id=?").get(value.id))!;
    if(booking.status==="fulfilled"){
      assert.equal(row.archived,0);
      if(removal.status==="fulfilled") assert.deepEqual(removal.value,{removed:0,booked:1,unavailable:0});
    }else{
      assert.equal(row.archived,1);
      assert.equal((await getDb().prepare("SELECT COUNT(*) total FROM bookings WHERE slot_id=?").get(value.id))!.total,0);
    }
  }
});
