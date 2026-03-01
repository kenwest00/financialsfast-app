import Dexie, { Table } from 'dexie';

export interface QuestionnaireData {
  id?: number;
  sessionId: string;
  completedAt?: Date;
  currentSection: number;

  // Section A – Business Identity
  businessName: string;
  businessType: string;
  entityType: string;
  industry: string;
  businessDescription: string;
  startDate: string;
  employeeCount: string;
  workerTypes: string[];

  // Section B – Revenue
  primaryRevenueSources: string;
  paymentProcessors: string[];
  otherPaymentProcessors: string;
  hasRecurringRevenue: boolean;
  recurringRevenueDescription: string;

  // Section C – COGS (conditional)
  isServiceBusiness: boolean;
  skipCOGS: boolean;
  inventoryVendors: string;
  directLaborIncluded: boolean;
  shippingInCOGS: boolean;

  // Section D1 – Recurring Services
  softwareSubscriptions: string;
  advertisingPlatforms: string[];
  hasOfficeRent: boolean;
  rentAmount: string;
  professionalServices: string;
  hasInsurance: boolean;
  insuranceTypes: string[];

  // Section D2 – Operations
  hasBusinessLoans: boolean;
  loanLenders: string;
  hasVehicleExpense: boolean;
  vehicleBusinessPercent: string;
  hasTravelExpense: boolean;
  hasMealsExpense: boolean;
  mealsBusinessPercent: string;
  hasShippingExpense: boolean;
  otherExpenses: string;

  // Section E – Personal vs Business
  hasMixedAccount: boolean;
  primaryPersonalVendors: string;
  ownerPaymentMethod: string;
  ownerDrawAmount: string;

  // Section F – Preferences
  reportingBasis: string;
  statementPeriod: string;
  periodStart: string;
  periodEnd: string;
  monthsRequired: string;

  // Section G – Anomalies
  hasLargeSinglePayments: boolean;
  largeSinglePaymentDescription: string;
  hasSeasonalVariation: boolean;
  seasonalDescription: string;
  additionalContext: string;
}

export interface UploadedFile {
  id?: number;
  sessionId: string;
  fileName: string;
  fileData: ArrayBuffer;
  fileSize: number;
  uploadedAt: Date;
  statementMonth: string;
  statementYear: string;
  parsedTransactions?: string; // JSON string
}

export interface PaymentRecord {
  id?: number;
  sessionId: string;
  stripeSessionId: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  amount: number;
  paidAt?: Date;
  receiptData?: string; // JSON string
}

export interface ClassificationResult {
  id?: number;
  sessionId: string;
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  subcategory: string;
  isBusinessExpense: boolean;
  confidence: number;
  needsReview: boolean;
  userOverride?: string;
}

export interface GeneratedReport {
  id?: number;
  sessionId: string;
  generatedAt: Date;
  pdfData?: ArrayBuffer;
  reportData: string; // JSON string of P&L data
}

class FinancialsFastDB extends Dexie {
  questionnaire!: Table<QuestionnaireData>;
  uploadedFiles!: Table<UploadedFile>;
  payments!: Table<PaymentRecord>;
  classifications!: Table<ClassificationResult>;
  reports!: Table<GeneratedReport>;

  constructor() {
    super('FinancialsFastDB');
    this.version(1).stores({
      questionnaire: '++id, sessionId',
      uploadedFiles: '++id, sessionId',
      payments: '++id, sessionId, stripeSessionId',
      classifications: '++id, sessionId, transactionId',
      reports: '++id, sessionId',
    });
  }
}

export const db = new FinancialsFastDB();

// Session management
export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = sessionStorage.getItem('ff_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('ff_session_id', sessionId);
  }
  return sessionId;
}

// Save questionnaire progress
export async function saveQuestionnaireProgress(
  sessionId: string,
  data: Partial<QuestionnaireData>
) {
  const existing = await db.questionnaire
    .where('sessionId')
    .equals(sessionId)
    .first();

  if (existing?.id) {
    await db.questionnaire.update(existing.id, { ...data, sessionId });
  } else {
    await db.questionnaire.add({
      sessionId,
      currentSection: 0,
      businessName: '',
      businessType: '',
      entityType: '',
      industry: '',
      businessDescription: '',
      startDate: '',
      employeeCount: '',
      workerTypes: [],
      primaryRevenueSources: '',
      paymentProcessors: [],
      otherPaymentProcessors: '',
      hasRecurringRevenue: false,
      recurringRevenueDescription: '',
      isServiceBusiness: false,
      skipCOGS: false,
      inventoryVendors: '',
      directLaborIncluded: false,
      shippingInCOGS: false,
      softwareSubscriptions: '',
      advertisingPlatforms: [],
      hasOfficeRent: false,
      rentAmount: '',
      professionalServices: '',
      hasInsurance: false,
      insuranceTypes: [],
      hasBusinessLoans: false,
      loanLenders: '',
      hasVehicleExpense: false,
      vehicleBusinessPercent: '',
      hasTravelExpense: false,
      hasMealsExpense: false,
      mealsBusinessPercent: '',
      hasShippingExpense: false,
      otherExpenses: '',
      hasMixedAccount: false,
      primaryPersonalVendors: '',
      ownerPaymentMethod: '',
      ownerDrawAmount: '',
      reportingBasis: 'cash',
      statementPeriod: '3',
      periodStart: '',
      periodEnd: '',
      monthsRequired: '3',
      hasLargeSinglePayments: false,
      largeSinglePaymentDescription: '',
      hasSeasonalVariation: false,
      seasonalDescription: '',
      additionalContext: '',
      ...data,
    });
  }
}

// Get questionnaire data
export async function getQuestionnaireData(
  sessionId: string
): Promise<QuestionnaireData | undefined> {
  return db.questionnaire.where('sessionId').equals(sessionId).first();
}

// Save uploaded file
export async function saveUploadedFile(
  sessionId: string,
  file: File,
  month: string,
  year: string
) {
  const buffer = await file.arrayBuffer();
  await db.uploadedFiles.add({
    sessionId,
    fileName: file.name,
    fileData: buffer,
    fileSize: file.size,
    uploadedAt: new Date(),
    statementMonth: month,
    statementYear: year,
  });
}

// Get uploaded files
export async function getUploadedFiles(
  sessionId: string
): Promise<UploadedFile[]> {
  return db.uploadedFiles.where('sessionId').equals(sessionId).toArray();
}

// Save payment record
export async function savePaymentRecord(
  sessionId: string,
  stripeSessionId: string
) {
  await db.payments.add({
    sessionId,
    stripeSessionId,
    paymentStatus: 'pending',
    amount: 12500,
  });
}

// Check payment status
export async function requirePayment(sessionId: string): Promise<boolean> {
  const payment = await db.payments
    .where('sessionId')
    .equals(sessionId)
    .first();
  return payment?.paymentStatus === 'paid';
}

// Mark payment as complete
export async function markPaymentComplete(
  stripeSessionId: string,
  receiptData: object
) {
  const payment = await db.payments
    .where('stripeSessionId')
    .equals(stripeSessionId)
    .first();
  if (payment?.id) {
    await db.payments.update(payment.id, {
      paymentStatus: 'paid',
      paidAt: new Date(),
      receiptData: JSON.stringify(receiptData),
    });
  }
}
