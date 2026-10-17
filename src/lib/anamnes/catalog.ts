import "server-only";
import { getDb, transaction } from "../database";
import type { User } from "../types";
import { FormulaRecordSchema, type FormulaRecord } from "./types";
import { formulaSeed } from "./catalog-seed";
import { AnamnesError } from "./http";
import { validateFormulaRules } from "./questions";

function admin(actor: User) {
  if (actor.role !== "admin") throw new AnamnesError("Du har inte behörighet till detta.", 403);
}
async function initializeCatalog() {
  if (await getDb().prepare("SELECT value FROM app_meta WHERE key='anamnes_catalog_seed_v2'").get()) return;
  await transaction(async () => {
    if (await getDb().prepare("SELECT value FROM app_meta WHERE key='anamnes_catalog_seed_v2'").get()) return;
    for (const seed of formulaSeed) {
      const entry = FormulaRecordSchema.parse(seed);
      await getDb().prepare("INSERT OR IGNORE INTO anamnes_formulas(id,data_json,updated_at) VALUES(?,?,?)")
        .run(entry.id, JSON.stringify(entry), new Date().toISOString());
    }
    // A separate seed flag means an intentionally deleted entry stays deleted.
    await getDb().prepare("INSERT INTO app_meta(key,value) VALUES('anamnes_catalog_seed_v2','1')").run();
  });
}
export async function getFormulaCatalog(): Promise<FormulaRecord[]> {
  await initializeCatalog();
  const rows = await getDb().prepare("SELECT data_json,updated_at FROM anamnes_formulas ORDER BY id").all();
  return rows.map((row) => FormulaRecordSchema.parse({ ...JSON.parse(String(row.data_json)), updatedAt: String(row.updated_at) }));
}
export async function getFormulaCatalogEntry(id: string) {
  return (await getFormulaCatalog()).find((entry) => entry.id === id) ?? null;
}
export async function saveFormulaCatalogEntry(actor: User, input: unknown): Promise<FormulaRecord> {
  admin(actor);
  const value = FormulaRecordSchema.parse(input);
  if (!validateFormulaRules(value)) throw new AnamnesError("Formelns regler måste använda giltiga svar från frågebanken.");
  // A checkbox alone never creates a verified product. Verification evidence
  // must be recorded independently for identity, actual contents and safety.
  const checks = [
    [value.productIdentityVerified, value.identityEvidence], [value.ingredientsVerified, value.ingredientEvidence],
    [value.safetyVerified, value.safetyEvidence], [value.regulatoryVerified, value.regulatoryEvidence],
  ] as const;
  if (checks.some(([verified, evidence]) => verified && evidence.trim().length < 20) || (value.ingredientsVerified && (value.ingredients.length === 0 || value.ingredients.some((item) => !item.trim()))))
    throw new AnamnesError("Dokumentera verifieringsunderlaget innan du markerar produkten som verifierad.");
  await initializeCatalog();
  return transaction(async () => {
    const current = await getDb().prepare("SELECT updated_at,data_json FROM anamnes_formulas WHERE id=?").get(value.id);
    if (!current && value.updatedAt) throw new AnamnesError("Formeln har tagits bort. Ladda om sidan innan du skapar en ny formel.", 409);
    if (current && (!value.updatedAt || value.updatedAt !== current.updated_at)) throw new AnamnesError("Formeln har ändrats. Ladda om sidan innan du sparar.", 409);
    if (current) {
      const previous = FormulaRecordSchema.parse(JSON.parse(String(current.data_json)));
      if (previous.productId !== value.productId && checks.some(([verified]) => verified))
        throw new AnamnesError("Avmarkera alla fyra verifieringar innan du byter kopplad produkt. Spara kopplingen och verifiera sedan den nya produktens underlag.");
      const ingredientsChanged = JSON.stringify(previous.ingredients.map((item) => item.trim())) !== JSON.stringify(value.ingredients.map((item) => item.trim()));
      if (ingredientsChanged && (value.ingredientsVerified || value.safetyVerified))
        throw new AnamnesError("Avmarkera ingrediens- och säkerhetsverifieringen innan du ändrar ingredienslistan. Spara innehållet och verifiera sedan det uppdaterade underlaget.");
    }
    const updatedAt = new Date(Math.max(Date.now(), current ? Date.parse(String(current.updated_at)) + 1 : 0)).toISOString();
    const entry = { ...value, productUrl: null, updatedAt };
    await getDb().prepare("INSERT INTO anamnes_formulas(id,data_json,updated_at,updated_by) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,updated_by=excluded.updated_by")
      .run(entry.id, JSON.stringify(entry), updatedAt, actor.id);
    return entry;
  });
}
export async function deleteFormulaCatalogEntry(actor: User, id: string, expectedUpdatedAt?: string) {
  admin(actor);
  await initializeCatalog();
  await transaction(async () => {
    const current = await getDb().prepare("SELECT updated_at FROM anamnes_formulas WHERE id=?").get(id);
    if (!current) return;
    if (!expectedUpdatedAt || expectedUpdatedAt !== current.updated_at) throw new AnamnesError("Formeln har ändrats. Ladda om sidan innan du tar bort den.", 409);
    await getDb().prepare("DELETE FROM anamnes_formulas WHERE id=?").run(id);
  });
}
export async function publicFormulaCatalog(): Promise<FormulaRecord[]> {
  const catalog = (await getFormulaCatalog()).filter((entry) => entry.active);
  const settings = await getDb().prepare("SELECT enabled FROM shop_settings WHERE id=1").get();
  const products = await getDb().prepare("SELECT id,slug FROM shop_products WHERE published=1").all();
  const publishedIds = new Set(products.map((entry) => Number(entry.id)));
  return catalog.map((entry) => {
    const available = !!settings?.enabled && !!entry.productId && publishedIds.has(entry.productId) && entry.productIdentityVerified && entry.ingredientsVerified && entry.safetyVerified && entry.regulatoryVerified && entry.ingredients.length > 0 && entry.ingredients.every((item) => !!item.trim()) && [entry.identityEvidence, entry.ingredientEvidence, entry.safetyEvidence, entry.regulatoryEvidence].every((item) => item.trim().length >= 20);
    // Internal supplier documents/notes never leave the server. A null product
    // reference fails closed even if a client sees verified classical fields.
    const evidence = available ? "Verifieringsunderlag granskat och dokumenterat av verksamheten." : "";
    const product = available ? products.find((item) => Number(item.id) === entry.productId) : null;
    return { ...entry, productId: available ? entry.productId : null, productUrl: product ? `/butik/${encodeURIComponent(String(product.slug))}` : null, identityEvidence: evidence, ingredientEvidence: evidence, safetyEvidence: evidence, regulatoryEvidence: evidence };
  });
}
