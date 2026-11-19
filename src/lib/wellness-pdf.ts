import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { getDb } from "./db";
import type { WellnessReceipt } from "./wellness";

const money = (ore: number) => `${(ore / 100).toFixed(2).replace(".", ",")} kr`;
const date = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date(iso));

export async function renderWellnessPdf(receipt: WellnessReceipt) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${receipt.kind === "correction" ? "Korrigeringsunderlag" : "Friskvårdskvitto"} ${receipt.number}`);
  doc.setAuthor(receipt.seller.legalName);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const ink = rgb(.14, .25, .20), olive = rgb(.21, .35, .30), gray = rgb(.30, .34, .30);
  let page!: PDFPage, y = 0;
  const addPage = () => {
    page = doc.addPage([595.28, 841.89]); y = 785;
    page.drawText("Tibb.nu", { x: 44, y, font: serif, size: 29, color: olive });
    page.drawSvgPath("M20 28C12 29 8 24 8 18c8 0 13 3 12 10ZM25 20C17 22 14 17 15 11c7 0 12 3 10 9ZM30 14c-5-6-2-11 3-13 4 5 4 10-3 13ZM22 26c8-1 13 2 13 8-8 1-12-2-13-8Z", { x: 510, y: 809, scale: .8, color: olive });
    page.drawLine({ start: { x: 44, y: 766 }, end: { x: 551, y: 766 }, thickness: .8, color: olive }); y = 738;
  };
  const ensure = (height: number) => { if (y - height < 65) addPage(); };
  const write = (text: string, options: { size?: number; strong?: boolean; width?: number; color?: typeof ink } = {}) => {
    const font = options.strong ? bold : body; const size = options.size ?? 10;
    for (const paragraph of String(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        // Split long references at character boundaries, without truncating the
        // recorded payment reference or silently dropping customer characters.
        for (const part of word.match(/.{1,65}/gu) ?? [""]) {
          const next = line ? `${line} ${part}` : part;
          if (font.widthOfTextAtSize(next, size) > (options.width ?? 503) && line) {
            ensure(size + 5); page.drawText(line, { x: 44, y, font, size, color: options.color ?? ink }); y -= size + 5; line = part;
          } else line = next;
        }
      }
      ensure(size + 5); page.drawText(line, { x: 44, y, font, size, color: options.color ?? ink }); y -= size + 5;
    }
  };
  addPage();
  write(receipt.kind === "correction" ? "KORRIGERINGSUNDERLAG - FRISKVÅRD" : "KVITTO - FRISKVÅRD", { size: 17, strong: true });
  y -= 9;
  write(`Kvittonummer: ${receipt.number}     Ordernummer: ${receipt.orderNumber}`, { strong: true });
  if (receipt.originalNumber) write(`Avser ursprungskvitto: ${receipt.originalNumber}`);
  write(`Utfärdat: ${date(receipt.issuedAt)}     ${receipt.kind === "correction" ? "Återbetalningsdatum" : "Betalningsdatum"}: ${date(receipt.paidAt)}`);
  write(`Betalningsstatus: ${receipt.kind === "purchase" ? "Betald" : "Korrigering av betalt köp"}`);
  write(`Betalningsmetod: ${receipt.paymentMethod}`);
  write(`Betalningsreferens: ${receipt.paymentReference}`, { size: 9 });
  y -= 12;
  write(receipt.seller.legalName, { strong: true });
  write(`Org.nr ${receipt.seller.organizationNumber}   Momsreg.nr ${receipt.seller.vatNumber}`, { size: 9 });
  write(receipt.seller.address, { size: 9 }); write(`${receipt.seller.email}   ${receipt.seller.website}`, { size: 9 });
  y -= 13;
  write(`Kund: ${receipt.customer.name}`, { strong: true }); write(receipt.customer.address); write(receipt.customer.email, { size: 9 });
  y -= 17;
  write("Specificerade friskvårdstjänster", { size: 12, strong: true });
  for (const item of receipt.items) {
    ensure(78); y -= 8;
    page.drawLine({ start: { x: 44, y: y + 13 }, end: { x: 551, y: y + 13 }, thickness: .4, color: rgb(.78, .82, .77) });
    write(item.name, { strong: true, width: 490 });
    write(`${item.quantity} tillfällen  |  À-pris ${money(item.priceOre)} inkl. moms  |  Moms ${item.vatPercent} %`, { size: 9 });
    write(`Radbelopp efter eventuella rabatter: ${money(item.totalOre)}`, { strong: true });
    if (item.validUntil) write(`Personligt klippkort, giltigt till ${date(item.validUntil)}`, { size: 9, color: gray });
  }
  y -= 20; ensure(130);
  write(`Totalt exklusive moms: ${money(receipt.vat.reduce((sum, group) => sum + group.netOre, 0))}`);
  for (const group of receipt.vat) write(`Moms ${group.percent} %: ${money(group.taxOre)}`);
  write(`Totalt inklusive moms: ${money(receipt.totalOre)}`);
  write(`${receipt.kind === "correction" ? "Korrigerat belopp" : "Faktiskt betalt för friskvård"}: ${money(receipt.totalOre)}`, { size: 13, strong: true });
  y -= 18;
  write("Klippkortet är personligt och gäller endast de specificerade tjänsterna, inte ett saldo i pengar. Friskvård avser avslappning, välbefinnande och hälsosamma levnadsvanor. Medicinsk behandling och produkter ingår inte i detta underlag.", { size: 9, color: gray });
  y -= 5;
  write("Detta är ett betalningsunderlag för friskvårdsbidrag. Arbetsgivaren avgör om ersättning beviljas. Underlaget avser samma försäljning som ordern och är ingen ytterligare försäljning.", { size: 9, color: gray });
  for (const [index, sheet] of doc.getPages().entries()) sheet.drawText(`${receipt.number}  |  ${index + 1}/${doc.getPageCount()}`, { x: 44, y: 30, size: 8, font: body, color: gray });
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
