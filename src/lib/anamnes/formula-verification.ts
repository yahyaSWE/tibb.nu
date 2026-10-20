import type { FormulaRecord } from './types';

/** Supplier documentation is evidence of what was stated, not product approval. */
export function supplierVerificationPending(formula: FormulaRecord): boolean {
  return formula.requiresVerification || !!formula.supplierProfile?.verificationIssues.length && formula.verificationResolution.trim().length < 40;
}
