import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { z } from "zod";
import { getBookingTerms } from "./business-settings";
import { getBookingByReference, getDb, type Booking } from "./db";
import { formatDateTime, formatMoney } from "./time";
import { getWellnessSeller } from "./wellness";

const capturedTax = z.object({
  total_amount: z.number().int().nonnegative(),
  total_tax_amount: z.number().int().nonnegative(),
  tax_rate: z.number().int().nonnegative(),
});

export function hasBookingReceipt(booking: Pick<Booking, "priceOre" | "paymentStatus">) {
  return booking.priceOre > 0 && (booking.paymentStatus === "paid" || booking.paymentStatus === "refunded");
}

export async function getBookingReceipt(reference: string) {
  const booking = await getBookingByReference(reference);
  if (!booking || !hasBookingReceipt(booking)) return null;
  const [seller, terms, payment, kustom] = await Promise.all([
    getWellnessSeller(),
    getBookingTerms(reference),
    getDb().prepare("SELECT paid_at FROM booking_payment_evidence WHERE booking_id=?").get(booking.id),
    booking.paymentMethod === "kustom" ? getDb().prepare("SELECT line_json FROM kustom_service_payments WHERE reference=?").get(reference) : null,
  ]);
  const tax = kustom ? capturedTax.safeParse(JSON.parse(String(kustom.line_json))) : null;
  const number = `BK-${booking.id}`;
  const bytes = await renderBookingReceipt({
    number,
    booking,
    issuedAt: new Date().toISOString(),
    paidAt: payment ? String(payment.paid_at) : null,
    tax: tax?.success && tax.data.total_amount === booking.priceOre && tax.data.total_tax_amount <= booking.priceOre
      ? { ore: tax.data.total_tax_amount, percent: tax.data.tax_rate / 100 } : null,
    seller: {
      ...seller,
      legalName: terms?.legalName ?? seller.legalName,
      organizationNumber: terms?.organizationNumber ?? seller.organizationNumber,
    },
  });
  return { number, bytes };
}

type Receipt = {
  number: string;
  booking: Booking;
  issuedAt: string;
  paidAt: string | null;
  tax: { ore: number; percent: number } | null;
  seller: Pick<Awaited<ReturnType<typeof getWellnessSeller>>, "legalName" | "organizationNumber" | "vatNumber" | "address" | "email">;
};

function receiptLines(value: string, font: PDFFont, size: number, width: number) {
  const clean = Array.from(value.replace(/\s+/g, " "), character => {
    try { font.encodeText(character); return character; }
    catch { return "?"; }
  }).join("");
  const lines: string[] = [];
  let line = "";
  for (const word of clean.trim().split(/ +/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderBookingReceipt({ number, booking, issuedAt, paidAt, seller, tax }: Receipt) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Kvitto ${number}`);
  doc.setAuthor(seller.legalName);
  doc.setCreationDate(new Date(issuedAt));
  const [sans, bold, serif] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold), doc.embedFont(StandardFonts.TimesRoman),
  ]);
  const deep = rgb(.14, .25, .20);
  const muted = rgb(.34, .42, .36);
  const sage = rgb(.90, .93, .89);
  const paper = rgb(.97, .96, .93);
  const left = 46;
  const right = 549;
  const width = right - left;
  function newPage() {
    const sheet = doc.addPage([595.28, 841.89]);
    sheet.drawRectangle({ x: 0, y: 756, width: sheet.getWidth(), height: 86, color: deep });
    sheet.drawText("Tibb.nu", { x: left, y: 787, font: serif, size: 28, color: paper });
    return sheet;
  }
  let page = newPage();
  page.drawText("Kvitto", { x: left, y: 696, font: serif, size: 42, color: deep });
  page.drawText(number, { x: left, y: 672, font: bold, size: 11, color: muted });

  let y = 629;
  const ensure = (height: number) => {
    if (y - height >= 64) return;
    page = newPage();
    y = 716;
    page.drawText(`Kvitto ${number}`, { x: left, y, font: bold, size: 12, color: deep });
    y -= 33;
  };
  const rows = (label: string, value: string) => {
    const lines = receiptLines(value, sans, 11, width - 125);
    ensure(lines.length * 17 + 8);
    page.drawText(label, { x: left, y, font: bold, size: 10, color: muted });
    for (const line of lines) {
      page.drawText(line, { x: left + 125, y, font: sans, size: 11, color: deep });
      y -= 17;
    }
    y -= 8;
  };
  const rule = () => {
    ensure(47);
    y -= 3;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: .6, color: muted });
    y -= 21;
  };
  rows("Utfärdat", formatDateTime(issuedAt));
  if (paidAt) rows("Betalat", formatDateTime(paidAt));
  rows("Säljare", seller.legalName);
  rows("Org.nr", seller.organizationNumber);
  if (seller.address) rows("Adress", seller.address);
  if (seller.vatNumber) rows("Momsnr", seller.vatNumber);
  rule();
  rows("Kund", booking.name);
  rows("Behandling", booking.treatmentName);
  rows("Bokad tid", formatDateTime(booking.start));
  rows("Betalningssätt", { kustom: "Via Kustom Checkout", stripe: "Kort via Stripe", onsite: "Betalning på plats" }[booking.paymentMethod]);
  if (booking.discount) {
    rows("Ordinarie pris", formatMoney(booking.priceOre + booking.discount.amountOre));
    rows("Rabatt", "-" + formatMoney(booking.discount.amountOre));
  }
  if (tax) rows(`Varav moms (${tax.percent} %)`, formatMoney(tax.ore));

  ensure(booking.paymentStatus === "refunded" ? 87 : 56);
  page.drawRectangle({ x: left, y: y - 34, width, height: 47, color: sage });
  page.drawText("Betalt belopp", { x: left + 13, y: y - 15, size: 11, font: bold, color: deep });
  const total = formatMoney(booking.priceOre).replace(/\s/g, " ");
  page.drawText(total, { x: right - 13 - bold.widthOfTextAtSize(total, 17), y: y - 17, size: 17, font: bold, color: deep });
  y -= 56;
  if (booking.paymentStatus === "refunded") rows("Återbetalt", total);
  const contact = receiptLines(seller.email, sans, 10, width)[0];
  if (contact) page.drawText(contact, { x: left, y: 47, font: sans, size: 10, color: muted });
  return doc.save();
}
