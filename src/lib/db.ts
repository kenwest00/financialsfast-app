// In-memory session store — no IndexedDB, no database
// Data lives in the browser tab for the duration of the session

export interface QuestionnaireData {
  [key: string]: unknown;
  businessName: string;
  businessType: string;
  entityType: string;
  industry: string;
  businessDescription: string;
  startDate: string;
  employeeCount: string;
  workerTypes: string[];
  primaryRevenueSources: string;
  paymentProcessors: string[];
  otherPaymentProcessors: string;
  hasRecurringRevenue: boolean;
  recurringRevenueDescription: string;
  isServiceBusiness: boolean;
  skipCOGS: boolean;
  inventoryVendors: string;
  directLaborIncluded: boolean;
  shippingInCOGS: boolean;
  softwareSubscriptions: string;
  advertisingPlatforms: string[];
  hasOfficeRent: boolean;
  rentAmount: string;
  professionalServices: string;
  hasInsurance: boolean;
  insuranceTypes: string[];
  hasBusinessLoans: boolean;
  loanLenders: string;
  hasVehicleExpense: boolean;
  vehicleBusinessPercent: string;
  hasTravelExpense: boolean;
  hasMealsExpense: boolean;
  mealsBusinessPercent: string;
  hasShippingExpense: boolean;
  otherExpenses: string;
  hasMixedAccount: boolean;
  primaryPersonalVendors: string;
  ownerPaymentMethod: string;
  ownerDrawAmount: string;
  reportingBasis: string;
  statementPeriod: string;
  periodStart: string;
  periodEnd: string;
  monthsRequired: string;
  hasLargeSinglePayments: boolean;
  largeSinglePaymentDescription: string;
  hasSeasonalVariation: boolean;
  seasonalDescription: string;
  additionalContext: string;
  currentSection: number;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  fileData: ArrayBuffer;
  fileSize: number;
  uploadedAt: Date;
  statementMonth: string;
  statementYear: string;
}

export interface PaymentRecord {
  stripeSessionId: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  amount: number;
  paidAt?: Date;
}

export interface GeneratedReport {
  generatedAt: Date;
  reportData: string;
}

const store: {
  questionnaire: Partial<QuestionnaireData>;
  files: UploadedFile[];
  payment: PaymentRecord | null;
  report: GeneratedReport | null;
  sessionId: string;
} = {
  questionnaire: {},
  files: [],
  payment: null,
  report: null,
  sessionId: '',
};

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  if (!store.sessionId) {
    store.sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return store.sessionId;
}

export async function saveQuestionnaireProgress(
  _sessionId: string,
  data: Partial<QuestionnaireData>
): Promise<void> {
  store.questionnaire = { ...store.questionnaire, ...data };
}

export async function getQuestionnaireData(
  _sessionId: string
): Promise<Partial<QuestionnaireData> | undefined> {
  return Object.keys(store.questionnaire).length > 0 ? store.questionnaire : undefined;
}

export async function saveUploadedFile(
  _sessionId: string,
  file: File,
  month: string,
  year: string
): Promise<void> {
  const buffer = await file.arrayBuffer();
  store.files.push({
    id: Math.random().toString(36).slice(2),
    fileName: file.name,
    fileData: buffer,
    fileSize: file.size,
    uploadedAt: new Date(),
    statementMonth: month,
    statementYear: year,
  });
}

export async function getUploadedFiles(_sessionId: string): Promise<UploadedFile[]> {
  return store.files;
}

export async function removeUploadedFile(id: string): Promise<void> {
  store.files = store.files.filter((f) => f.id !== id);
}

export async function savePaymentRecord(
  _sessionId: string,
  stripeSessionId: string
): Promise<void> {
  store.payment = {
    stripeSessionId,
    paymentStatus: 'pending',
    amount: 12500,
  };
}

export async function requirePayment(_sessionId: string): Promise<boolean> {
  return store.payment?.paymentStatus === 'paid';
}

export async function markPaymentComplete(
  stripeSessionId: string,
  _receiptData: object
): Promise<void> {
  if (!store.payment) {
    store.payment = {
      stripeSessionId,
      paymentStatus: 'paid',
      amount: 12500,
      paidAt: new Date(),
    };
  } else {
    store.payment.paymentStatus = 'paid';
    store.payment.paidAt = new Date();
  }
}

export async function saveReport(reportData: string): Promise<void> {
  store.report = { generatedAt: new Date(), reportData };
}

export async function getLatestReport(): Promise<GeneratedReport | null> {
  return store.report;
}

export const db = {
  reports: {
    where: () => ({
      equals: () => ({
        last: async () => store.report ?? null,
      }),
    }),
    add: async (data: { reportData: string }) => {
      store.report = { generatedAt: new Date(), reportData: data.reportData };
    },
  },
  uploadedFiles: {
    delete: async (id: string) => removeUploadedFile(id),
  },
};
