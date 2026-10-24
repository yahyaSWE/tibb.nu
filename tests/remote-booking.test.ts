import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createFirstAdmin, createUser, getDb, getTreatment, getTreatments, getBookingById, reserveBooking } from "../src/lib/db";
import { saveTreatment, saveSlot, saveBookingMeetingLink, updateBooking } from "../src/lib/admin";
import { hashPassword } from "../src/lib/security";
import { localDateTime } from "../src/lib/time";
import { anamnesPreparation, customerMeetingUrl } from "../src/lib/booking-details";
import { BookingVisitDetails } from "../src/components/booking-visit-details";
import { BookingPreparation } from "../src/components/booking-preparation";
import type { Booking, DeliveryMode } from "../src/lib/types";

for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "VERCEL", "RESEND_API_KEY", "EMAIL_FROM", "APP_URL"]) delete process.env[key];
process.env.TIBB_DATABASE_PATH = ":memory:";
let adminId: number, studentId: number, sequence = 0;
before(async () => {
  adminId = (await createFirstAdmin({name:"Remote Admin",email:"remote-admin@example.test",passwordHash:hashPassword("synthetic remote admin password")})).id;
  studentId = (await createUser({name:"Remote Student",email:"remote-student@example.test",passwordHash:hashPassword("synthetic remote student password"),role:"student"})).id;
});
after(async () => {await getDb().close();});
async function fixture(deliveryMode: DeliveryMode = "remote") {
  const name = `Synthetic treatment ${++sequence}`;
  await saveTreatment(adminId,{name,description:"Synthetic treatment",durationMinutes:30,price:"399",active:true,deliveryMode});
  const treatment = (await getTreatments()).find(value=>value.name===name)!;
  const day = localDateTime(new Date(Date.now() + (sequence+10)*86400000).toISOString()).slice(0,10);
  const slotId = await saveSlot(adminId,treatment.id,`${day}T10:00`);
  const booking = await reserveBooking({slotId,name:"Synthetic Customer",email:"remote-customer@example.test",phone:"",paymentMethod:"onsite"});
  return {treatment,booking};
}
function render(booking: Booking) {
  return renderToStaticMarkup(createElement(BookingVisitDetails,{booking,location:"PRIVATE_ONSITE_ADDRESS"}));
}

test("the treatment mode is snapshotted at booking and later treatment edits cannot turn a visit into a remote meeting",async()=>{
  const {treatment,booking}=await fixture();
  assert.equal(treatment.deliveryMode,"remote");assert.equal(booking.deliveryMode,"remote");
  assert.equal(booking.meetingUrl,"");
  await saveTreatment(adminId,{id:treatment.id,name:treatment.name,description:treatment.description,durationMinutes:30,price:"499",active:true,deliveryMode:"onsite"});
  assert.equal((await getTreatment(treatment.id))!.deliveryMode,"onsite");
  assert.equal((await getBookingById(booking.id))!.deliveryMode,"remote");
  assert.equal((await getBookingById(booking.id))!.priceOre,39900);
  assert.doesNotMatch(render(booking),/PRIVATE_ONSITE_ADDRESS/);
  assert.match(render(booking),/Behandlaren lägger till möteslänken här/);
  const onsite=await fixture("onsite");
  await assert.rejects(saveBookingMeetingLink(adminId,onsite.booking.id,"https://meeting.example.test/room"),/distansbokningar/);
  assert.match(render(onsite.booking),/PRIVATE_ONSITE_ADDRESS/);
});

test("only admins can save, replace and remove a meeting link; unsafe links and inactive bookings are rejected",async()=>{
  const {booking}=await fixture();
  await assert.rejects(saveBookingMeetingLink(studentId,booking.id,"https://meeting.example.test/room"),/behörighet/);
  for(const url of ["javascript:alert(1)","http://meeting.example.test/room","https://user:password@meeting.example.test/room","https://meeting.example.test/room\ninvalid"])
    await assert.rejects(saveBookingMeetingLink(adminId,booking.id,url));
  assert.equal((await getBookingById(booking.id))!.meetingUrl,"");
  await saveBookingMeetingLink(adminId,booking.id," https://meeting.example.test/first?token=private-fixture ");
  assert.equal((await getBookingById(booking.id))!.meetingUrl,"https://meeting.example.test/first?token=private-fixture");
  assert.match(render((await getBookingById(booking.id))!),/Öppna mötet/);
  await saveBookingMeetingLink(adminId,booking.id,"https://meeting.example.test/second");
  assert.equal(customerMeetingUrl((await getBookingById(booking.id))!),"https://meeting.example.test/second");
  await saveBookingMeetingLink(adminId,booking.id,"");
  assert.equal(customerMeetingUrl((await getBookingById(booking.id))!),null);
  await updateBooking(adminId,booking.id,"cancelled","pending");
  await assert.rejects(saveBookingMeetingLink(adminId,booking.id,"https://meeting.example.test/second"),/avbokad/);
});

test("meeting URLs are absent from pending, unpaid Stripe, onsite and cancelled customer views",async()=>{
  const {booking}=await fixture();
  const link="https://meeting.example.test/PRIVATE_ROOM_TOKEN";
  await saveBookingMeetingLink(adminId,booking.id,link);
  const current=(await getBookingById(booking.id))!;
  for(const patch of [{status:"pending"},{status:"cancelled"},{status:"completed"},{deliveryMode:"onsite"},{paymentMethod:"stripe",paymentStatus:"pending"},{paymentMethod:"stripe",paymentStatus:"refunded"}] as const){
    assert.equal(customerMeetingUrl({...current,...patch}),null);
    assert.doesNotMatch(render({...current,...patch}),/PRIVATE_ROOM_TOKEN/);
  }
  assert.equal(customerMeetingUrl({...current,paymentMethod:"stripe",paymentStatus:"paid"}),link);
  assert.match(render(current),/rel="noopener noreferrer"/);
  assert.equal(customerMeetingUrl({...current,meetingUrl:"javascript:alert(1)"}),null);
});

test("the anamnes reminder gives a real 24-hour deadline across Swedish clock changes, a near-visit fallback and a form link",()=>{
  const start="2026-10-25T10:00:00.000Z",now=Date.parse("2026-10-22T08:00:00.000Z");
  const text=anamnesPreparation(start,now);
  assert.match(text,/24 timmar/);assert.match(text,/24 oktober 2026/);assert.match(text,/12:00/);
  const html=renderToStaticMarkup(createElement(BookingPreparation,{start,now}));
  assert.match(html,/href="\/anamnes"/);assert.match(html,/Skicka till behandlaren/);
  assert.match(anamnesPreparation(start,Date.parse("2026-10-25T09:00:00.000Z")),/kortare framförhållning/);
  assert.equal(renderToStaticMarkup(createElement(BookingPreparation,{start,now:Date.parse("2026-10-26T00:00:00Z")})),"");
});
