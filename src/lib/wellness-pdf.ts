import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDb } from "./db";
import { WELLNESS_ADDRESS_THRESHOLD_ORE } from "./shop-types";
import type { WellnessReceipt } from "./wellness";

const money = (ore: number) => new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(ore / 100).replace(/\s/g, " ").replace("−", "-") + " kr";
const date = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date(iso));

const paper = rgb(.96, .96, .93);
const deep = rgb(.14, .25, .20);
const secondary = rgb(.27, .36, .30);
const rule = rgb(.76, .81, .76);
const pale = rgb(.90, .93, .89);
const white = rgb(1, 1, 1);
const left = 42;
const right = 553;
const width = right - left;
const mark = "M20 28C12 29 8 24 8 18c8 0 13 3 12 10ZM25 20C17 22 14 17 15 11c7 0 12 3 10 9ZM30 14c-5-6-2-11 3-13 4 5 4 10-3 13ZM22 26c8-1 13 2 13 8-8 1-12-2-13-8Z";

function wrap(text: string, font: PDFFont, size: number, measure: number) {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = [];
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(next, size) <= measure) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && font.widthOfTextAtSize(line + character, size) > measure) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines;
  });
}

export async function renderWellnessPdf(receipt: WellnessReceipt, options: { omitCustomerAddress?: boolean } = {}) {
  const doc = await PDFDocument.create();
  const purchase = receipt.kind === "purchase";
  const title = purchase ? "Friskvårdskvitto" : "Korrigeringsunderlag";
  doc.setTitle(title + " " + receipt.number);
  doc.setAuthor(receipt.seller.legalName);
  const [body, bold, serif] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.TimesRoman),
  ]);
  let page!: PDFPage;
  let y = 0;

  function addPage() {
    page = doc.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 758, width: page.getWidth(), height: 84, color: deep });
    page.drawText("Tibb.nu", { x: left, y: 785, font: serif, size: 29, color: white });
    page.drawText("- Traditionell kinesisk medicin", { x: 141, y: 787, font: body, size: 11, color: pale });
    page.drawSvgPath(mark, { x: 515, y: 810, scale: .9, color: pale });
    y = 719;
  }

  function ensure(height: number) {
    if (y - height < 57) addPage();
  }

  function text(value: string, x: number, at: number, font = body, size = 10, color = deep) {
    page.drawText(value, { x, y: at, font, size, color });
  }

  function line(at: number, x = left, end = right) {
    page.drawLine({ start: { x, y: at }, end: { x: end, y: at }, thickness: .6, color: rule });
  }

  function aligned(value: string, at: number, end = right, font = body, size = 10, color = deep) {
    text(value, end - font.widthOfTextAtSize(value, size), at, font, size, color);
  }

  function paragraph(value: string, size = 9, color = secondary) {
    for (const row of wrap(value, body, size, width)) {
      ensure(size + 5);
      text(row, left, y, body, size, color);
      y -= size + 5;
    }
  }

  addPage();
  text(title, left, y, serif, 34);
  y -= 29;
  text(receipt.number, left, y, bold, 11);
  text("Order " + receipt.orderNumber, left + 135, y, body, 10, secondary);
  aligned(purchase ? "Betald" : "Återbetalning", y, right, bold, 11);
  y -= 19;
  line(y);
  y -= 20;

  const metadata = [
    "Utfärdat " + date(receipt.issuedAt),
    (purchase ? "Betald " : "Återbetald ") + date(receipt.paidAt),
  ];
  if (receipt.originalNumber) metadata.push("Avser " + receipt.originalNumber);
  paragraph(metadata.join("   |   "));
  paragraph("Betalsätt: " + receipt.paymentMethod);
  paragraph("Betalningsreferens: " + receipt.paymentReference);
  y -= 13;

  const address = options.omitCustomerAddress && Math.abs(receipt.totalOre) <= WELLNESS_ADDRESS_THRESHOLD_ORE ? "" : receipt.customer.address;
  const columns = [
    { label: "UTFÄRDARE", x: left, name: receipt.seller.legalName, details: [
      receipt.seller.address,
      "Org.nr " + receipt.seller.organizationNumber,
      "Momsreg.nr " + receipt.seller.vatNumber,
      receipt.seller.email,
      receipt.seller.website,
    ] },
    { label: "KUND", x: 312, name: receipt.customer.name, details: [address, receipt.customer.email] },
  ];
  let lowest = y;
  for (const column of columns) {
    text(column.label, column.x, y, bold, 8, secondary);
    let baseline = y - 20;
    for (const name of wrap(column.name, bold, 12, 238)) {
      text(name, column.x, baseline, bold, 12);
      baseline -= 15;
    }
    for (const value of column.details.filter(Boolean)) {
      for (const row of wrap(value, body, 9, 238)) {
        text(row, column.x, baseline);
        baseline -= 14;
      }
    }
    if (purchase && column.label === "KUND") {
      text("Personnummer (valfritt)", column.x, baseline - 4, body, 9, secondary);
      const field = doc.getForm().createTextField("personnummer");
      field.setMaxLength(13);
      field.addToPage(page, { x: column.x, y: baseline - 30, width: 141, height: 20, borderWidth: .6, borderColor: rule, backgroundColor: paper, textColor: deep, font: body });
      field.setFontSize(10);
      field.updateAppearances(body);
      baseline -= 38;
    }
    lowest = Math.min(lowest, baseline);
  }
  y = lowest - 15;

  function itemsHeading() {
    ensure(39);
    text("Friskvårdstjänster", left, y, serif, 19);
    aligned("Belopp inkl. moms", y, right, bold, 9, secondary);
    y -= 13;
    line(y);
    y -= 19;
  }

  itemsHeading();
  for (const item of receipt.items) {
    const names = wrap(item.name, bold, 11, width - 126);
    const height = names.length * 15 + (item.validUntil ? 46 : 32);
    if (y - height < 57) {
      addPage();
      itemsHeading();
    }
    aligned(money(item.totalOre), y, right, bold, 11);
    for (const name of names) {
      text(name, left, y, bold, 11);
      y -= 15;
    }
    paragraph(item.quantity + (item.quantity === 1 ? " tillfälle" : " tillfällen") + "   |   À-pris " + money(item.priceOre) + "   |   Moms " + item.vatPercent + " %");
    if (item.validUntil) paragraph("Personligt klippkort, giltigt till " + date(item.validUntil));
    y -= 3;
    line(y);
    y -= 18;
  }

  ensure(98 + receipt.vat.length * 15);
  y -= 8;
  const totalX = 272;
  const totals = [
    { label: "Totalt exklusive moms", amount: receipt.vat.reduce((sum, group) => sum + group.netOre, 0) },
    ...receipt.vat.map(group => ({ label: "Moms " + group.percent + " %", amount: group.taxOre })),
  ];
  for (const row of totals) {
    text(row.label, totalX, y, body, 10, secondary);
    aligned(money(row.amount), y);
    y -= 15;
  }
  y -= 16;
  page.drawRectangle({ x: totalX - 13, y: y - 17, width: right - totalX + 13, height: 39, color: pale });
  text(purchase ? "Betalt inkl. moms" : "Korrigerat inkl. moms", totalX, y - 1, bold, 10);
  aligned(money(receipt.totalOre), y - 3, right - 12, bold, 17);
  y -= 42;

  if (purchase) paragraph("Klippkortet är personligt och gäller de specificerade friskvårdstjänsterna. Medicinsk behandling och produkter ingår inte i detta underlag.");
  const pages = doc.getPages();
  for (const [index, sheet] of pages.entries()) {
    sheet.drawLine({ start: { x: left, y: 43 }, end: { x: right, y: 43 }, thickness: .6, color: rule });
    sheet.drawText(receipt.number, { x: left, y: 28, font: body, size: 8, color: secondary });
    const number = (index + 1) + " / " + pages.length;
    sheet.drawText(number, { x: right - body.widthOfTextAtSize(number, 8), y: 28, font: body, size: 8, color: secondary });
  }
  return doc.save();
}

export async function getWellnessPdf(receiptId: string) {
  const row = await getDb().prepare("SELECT snapshot_json,pdf FROM wellness_receipts WHERE id=?").get(receiptId);
  if (!row) throw new Error("Receipt not found");
  if (row.pdf) return new Uint8Array(row.pdf as ArrayBuffer);
  const pdf = await renderWellnessPdf(JSON.parse(String(row.snapshot_json)));
  await getDb().prepare("UPDATE wellness_receipts SET pdf=? WHERE id=? AND pdf IS NULL").run(pdf, receiptId);
  const stored = (await getDb().prepare("SELECT pdf FROM wellness_receipts WHERE id=?").get(receiptId))!;
  return new Uint8Array(stored.pdf as ArrayBuffer);
}

export async function regenerateWellnessPdfCopy(receiptId: string, omitCustomerAddress = false) {
  const row = await getDb().prepare("SELECT r.snapshot_json,o.total_ore FROM wellness_receipts r JOIN shop_orders o ON o.reference=r.order_reference WHERE r.id=?").get(receiptId);
  if (!row) return null;
  const receipt: WellnessReceipt = JSON.parse(String(row.snapshot_json));
  const pdf = await renderWellnessPdf(receipt, { omitCustomerAddress: omitCustomerAddress && Number(row.total_ore) <= WELLNESS_ADDRESS_THRESHOLD_ORE });
  return { pdf, number: receipt.number };
}
