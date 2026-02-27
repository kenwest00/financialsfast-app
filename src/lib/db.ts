import Dexie, { type EntityTable } from 'dexie';

// ─── Interfaces ────────────────────────────────────────────

export interface QuestionnaireData {
  id?: number;
  businessName: string;
  businessType: string;
  email: string;
  startDate: string;
  endDate: string;
  paymentProcessors: string[];
  lenders: string[];
  vendors: string[];
  completedAt: string;
}

export interface UploadedFile {
  id?: number;
  fileName: string;
  rawText: string;
  pageCount: number;
  transactionCount: number;
  uploadedAt: string;
}

export interface PaymentReceipt {
  id?: number;
  reportId: string;
  sessionId: string;
  amountPaid: number;
  paymentIntent: string;
  paidAt: string;
}

export interface ClassifiedTransaction {
  id?: number;
  reportId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  confidence: number;
  flagged: boolean;
  userOverride?: string;
  reasoning: string;
}

export interface GeneratedReport {
  id?: number;
  reportId: string;
  htmlContent: string;
  generatedAt: string;
}

// ─── Database ──────────────────────────────────────────────

class FinancialsFastDB extends Dexie {
  questionnaire!: EntityTable<QuestionnaireData, 'id'>;
  uploadedFiles!: EntityTable<UploadedFile, 'id'>;
  paymentReceipts!: EntityTable<PaymentReceipt, 'id'>;
  classifiedTransactions!: EntityTable<ClassifiedTransaction, 'id'>;
  generatedReports!: EntityTable<GeneratedReport, 'id'>;

  constructor() {
    super('FinancialsFastDB');

    this.version(1).stores({
      questionnaire: '++id',
      uploadedFiles: '++id, fileName',
      paymentReceipts: '++id, reportId, sessionId',
      classifiedTransactions: '++id, reportId, category, flagged',
      generatedReports: '++id, reportId',
    });
  }
}

export const db = new FinancialsFastDB();

// ─── Payment Guard ─────────────────────────────────────────
// Call before any API-cost operation (Claude classification, etc.)

export async function requirePayment(reportId: string): Promise<boolean> {
  const receipt = await db.paymentReceipts
    .where('reportId')
    .equals(reportId)
    .first();
  return !!receipt;
}

// ─── Helper: Get Current Session Data ──────────────────────

export async function getSessionSummary() {
  const questionnaire = await db.questionnaire.toCollection().last();
  const files = await db.uploadedFiles.toArray();
  const totalTransactions = files.reduce((sum, f) => sum + f.transactionCount, 0);

  return {
    questionnaire,
    uploadedFiles: files,
    transactionCount: totalTransactions,
    fileCount: files.length,
  };
}

// ─── Helper: Store Payment Receipt ─────────────────────────

export async function storePaymentReceipt(receipt: Omit<PaymentReceipt, 'id'>) {
  return db.paymentReceipts.add(receipt);
}

// ─── Helper: Get Report ID ─────────────────────────────────

export async function getActiveReportId(): Promise<string | null> {
  const receipt = await db.paymentReceipts.toCollection().last();
  return receipt?.reportId || null;
}

// ─── Helper: Clear All Data (post-download cleanup) ────────

export async function clearAllData() {
  await db.questionnaire.clear();
  await db.uploadedFiles.clear();
  await db.classifiedTransactions.clear();
  await db.generatedReports.clear();
  // Intentionally keep paymentReceipts for user's records
}
