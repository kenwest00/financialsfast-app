// In-memory session store — no IndexedDB, no database
// Data lives in the browser tab for the duration of the session

export type ProductType = 'pnl' | 'balance-sheet' | 'cashflow' | 'bundle';

export const PRODUCT_CONFIG = {
  pnl: {
    label: 'P&L Statement',
    shortLabel: 'P&L',
    price: 97,
    priceCents: 9700,
    priceDisplay: '$97',
    originalPrice: null,
    originalPriceDisplay: null,
    savings: null,
    savingsDisplay: null,
    deliverable: 'pdf' as const,
    timeEstimate: '~15 minutes',
    includes: ['pnl'] as ProductType[],
  },
  'balance-sheet': {
    label: 'Balance Sheet',
    shortLabel: 'Balance Sheet',
    price: 97,
    priceCents: 9700,
    priceDisplay: '$97',
    originalPrice: null,
    originalPriceDisplay: null,
    savings: null,
    savingsDisplay: null,
    deliverable: 'pdf' as const,
    timeEstimate: '~20 minutes',
    includes: ['balance-sheet'] as ProductType[],
  },
  cashflow: {
    label: 'Cash Flow Projection',
    shortLabel: 'Cash Flow',
    price: 97,
    priceCents: 9700,
    priceDisplay: '$97',
    originalPrice: null,
    originalPriceDisplay: null,
    savings: null,
    savingsDisplay: null,
    deliverable: 'pdf' as const,
    timeEstimate: '~20 minutes',
    includes: ['cashflow'] as ProductType[],
  },
  bundle: {
    label: 'Complete Financial Package',
    shortLabel: 'Full Package',
    price: 247,
    priceCents: 24700,
    priceDisplay: '$247',
    originalPrice: 291,
    originalPriceDisplay: '$291',
    savings: 44,
    savingsDisplay: '$44',
    deliverable: 'zip' as const,
    timeEstimate: '~45 minutes',
    includes: ['pnl', 'balance-sheet', 'cashflow'] as ProductType[],
  },
} as const;

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

export interface BalanceSheetData {
  [key: string]: unknown;
  cashAccounts: string;
  totalCashBalance: string;
  hasRestrictedCash: boolean;
  restrictedCashAmount: string;
  hasAccountsReceivable: boolean;
  arBalance: string;
  arAgingDays: string;
  hasInventory: boolean;
  inventoryValue: string;
  inventoryMethod: string;
  prepaidExpenses: string;
  otherCurrentAssets: string;
  hasEquipment: boolean;
  equipmentDescription: string;
  equipmentOriginalCost: string;
  equipmentAccumDepr: string;
  hasRealEstate: boolean;
  realEstateDescription: string;
  realEstateCost: string;
  realEstateAccumDepr: string;
  hasIntangibles: boolean;
  intangiblesDescription: string;
  intangiblesValue: string;
  hasSecurityDeposits: boolean;
  securityDepositTotal: string;
  otherLongTermAssets: string;
  hasAccountsPayable: boolean;
  apBalance: string;
  hasShortTermDebt: boolean;
  shortTermDebtDetails: string;
  currentPortionLTD: string;
  hasAccruedLiabilities: boolean;
  accruedWages: string;
  accruedTaxes: string;
  hasDeferredRevenue: boolean;
  deferredRevenueAmount: string;
  otherCurrentLiabilities: string;
  hasLongTermDebt: boolean;
  longTermDebtDetails: string;
  hasSBALoan: boolean;
  sbaBalance: string;
  sbaForgivenessStatus: string;
  hasLeaseObligations: boolean;
  leaseDetails: string;
  otherLongTermLiabilities: string;
  priorYearRetainedEarnings: string;
  ownerContributions: string;
  ownerDistributions: string;
  commonStockValue: string;
  additionalPaidInCapital: string;
  statementDate: string;
  includeComparativePrior: boolean;
  bsLenderName: string;
  currentBsSection: number;
}

// ─── Cash Flow Projection data ────────────────────────────────────────────────
// Based on ASC 230 — Statement of Cash Flows (Indirect Method)

export interface CashFlowData {
  [key: string]: unknown;

  // S1 — Projection setup
  businessName: string;
  entityType: string;
  projectionPeriodMonths: string;     // 12, 24, 36
  projectionStartDate: string;
  currentCashBalance: string;         // beginning cash
  presentationMethod: string;         // 'indirect' (standard) or 'direct'
  lenderName: string;

  // S2 — Revenue assumptions (Operating inflows)
  baselineMonthlyRevenue: string;
  revenueGrowthRate: string;          // monthly % or annual %
  revenueGrowthRatePeriod: string;    // 'monthly' | 'annual'
  hasSeasonalRevenue: boolean;
  seasonalPattern: string;
  seasonalMonths: string;             // which months are high/low
  newRevenueStreams: string;          // planned new sources, timing
  hasContractedRevenue: boolean;
  contractedRevenueDesc: string;

  // S3 — Operating expense assumptions (Operating outflows)
  // Fixed expenses (don't change with revenue)
  monthlyRent: string;
  monthlyPayroll: string;
  monthlyInsurance: string;
  monthlyLoanPayments: string;
  monthlySubscriptions: string;
  otherFixedExpenses: string;
  // Variable expenses (% of revenue)
  cogsPercent: string;                // cost of goods as % of revenue
  salesMarketingPercent: string;
  otherVariablePercent: string;
  // Planned expense changes
  expenseChanges: string;

  // S4 — Working capital (timing adjustments per ASC 230 indirect method)
  hasAccountsReceivable: boolean;
  arDaysOutstanding: string;          // how many days customers take to pay
  arGrowthExpected: boolean;
  hasInventory: boolean;
  inventoryDaysOnHand: string;
  hasAccountsPayable: boolean;
  apDaysOutstanding: string;          // how long you take to pay suppliers
  otherWorkingCapitalNotes: string;

  // S5 — Investing activities (ASC 230 Section 2)
  hasPlannedEquipmentPurchases: boolean;
  equipmentPurchases: { description: string; amount: string; month: string }[];
  hasPlannedRealEstate: boolean;
  realEstatePurchaseAmount: string;
  realEstatePurchaseMonth: string;
  hasAssetSales: boolean;
  assetSalesDesc: string;
  monthlyDepreciation: string;        // for indirect method add-back

  // S6 — Financing activities (ASC 230 Section 3)
  existingLoanPayments: { lender: string; monthlyPayment: string; payoffMonth: string }[];
  hasPlannedNewDebt: boolean;
  plannedNewDebt: { lender: string; amount: string; month: string; monthlyPayment: string }[];
  ownerContributionsPlanned: string;
  ownerDistributionsPlanned: string;  // monthly draws
  hasLineOfCredit: boolean;
  locLimit: string;
  locCurrentBalance: string;

  // S7 — Scenarios & assumptions
  projectionBasis: string;            // 'conservative' | 'base' | 'optimistic'
  minimumCashBuffer: string;          // cash floor they want to maintain
  hasKnownOneTimeEvents: boolean;
  oneTimeEventsDesc: string;          // tax payments, equipment, hires
  keyAssumptions: string;
  biggestRisks: string;
  includeScenarioAnalysis: boolean;   // best/base/worst case

  // S8 — Presentation
  presentationFrequency: string;      // 'monthly' | 'quarterly'
  includeCashWaterfall: boolean;      // month-by-month bar chart
  includeAssumptionsPage: boolean;
  includeVarianceAnalysis: boolean;

  currentCfSection: number;
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
  productType: ProductType;
  paidAt?: Date;
}

export interface GeneratedReport {
  generatedAt: Date;
  reportData: string;
}

const store: {
  productType: ProductType;
  questionnaire: Partial<QuestionnaireData>;
  balanceSheet: Partial<BalanceSheetData>;
  cashFlow: Partial<CashFlowData>;
  files: UploadedFile[];
  payment: PaymentRecord | null;
  report: GeneratedReport | null;
  sessionId: string;
} = {
  productType: 'pnl',
  questionnaire: {},
  balanceSheet: {},
  cashFlow: {},
  files: [],
  payment: null,
  report: null,
  sessionId: '',
};

// ─── Product type ─────────────────────────────────────────────────────────────

export function setProductType(type: ProductType): void {
  store.productType = type;
}

export function getProductType(): ProductType {
  return store.productType;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  if (!store.sessionId) {
    store.sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  return store.sessionId;
}

// ─── P&L questionnaire ───────────────────────────────────────────────────────

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

// ─── Balance sheet questionnaire ─────────────────────────────────────────────

export async function saveBalanceSheetProgress(
  _sessionId: string,
  data: Partial<BalanceSheetData>
): Promise<void> {
  store.balanceSheet = { ...store.balanceSheet, ...data };
}

export async function getBalanceSheetData(
  _sessionId: string
): Promise<Partial<BalanceSheetData> | undefined> {
  return Object.keys(store.balanceSheet).length > 0 ? store.balanceSheet : undefined;
}

// ─── Cash flow questionnaire ──────────────────────────────────────────────────

export async function saveCashFlowProgress(
  _sessionId: string,
  data: Partial<CashFlowData>
): Promise<void> {
  store.cashFlow = { ...store.cashFlow, ...data };
}

export async function getCashFlowData(
  _sessionId: string
): Promise<Partial<CashFlowData> | undefined> {
  return Object.keys(store.cashFlow).length > 0 ? store.cashFlow : undefined;
}

// ─── Files ───────────────────────────────────────────────────────────────────

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

// ─── Payment ─────────────────────────────────────────────────────────────────

export async function savePaymentRecord(
  _sessionId: string,
  stripeSessionId: string
): Promise<void> {
  store.payment = {
    stripeSessionId,
    paymentStatus: 'pending',
    amount: PRODUCT_CONFIG[store.productType].priceCents,
    productType: store.productType,
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
      amount: PRODUCT_CONFIG[store.productType].priceCents,
      productType: store.productType,
      paidAt: new Date(),
    };
  } else {
    store.payment.paymentStatus = 'paid';
    store.payment.paidAt = new Date();
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

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
