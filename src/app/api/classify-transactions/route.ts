import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    'anthropic-beta': 'prompt-caching-2024-07-31',
  },
});

function buildSystemPrompt(questionnaire: Record<string, unknown>): string {
  const {
    businessName, entityType, industry, businessDescription,
    primaryRevenueSources, paymentProcessors, isServiceBusiness,
    inventoryVendors, softwareSubscriptions, advertisingPlatforms,
    hasOfficeRent, rentAmount, professionalServices, hasInsurance,
    hasBusinessLoans, loanLenders, hasVehicleExpense, vehicleBusinessPercent,
    hasTravelExpense, hasMealsExpense, mealsBusinessPercent,
    hasMixedAccount, primaryPersonalVendors, ownerPaymentMethod,
    ownerDrawAmount, hasLargeSinglePayments, largeSinglePaymentDescription,
  } = questionnaire;

  return `You are an expert CPA classifying business transactions for a Profit & Loss statement.

## BUSINESS CONTEXT
- Business: ${businessName}
- Entity: ${entityType}
- Industry: ${industry}
- Description: ${businessDescription}

## REVENUE SOURCES
${primaryRevenueSources}
Payment processors: ${Array.isArray(paymentProcessors) ? paymentProcessors.join(', ') : paymentProcessors}

## COST STRUCTURE
Service business (no COGS): ${isServiceBusiness ? 'YES' : 'NO'}
${!isServiceBusiness ? `Inventory vendors: ${inventoryVendors}` : ''}

## KNOWN OPERATING EXPENSES
Software subscriptions: ${softwareSubscriptions}
Advertising platforms: ${Array.isArray(advertisingPlatforms) ? advertisingPlatforms.join(', ') : advertisingPlatforms}
${hasOfficeRent ? `Office rent: ~$${rentAmount}/month` : 'No office rent'}
Professional services: ${professionalServices}
${hasInsurance ? 'Has business insurance' : ''}
${hasBusinessLoans ? `Business loans: ${loanLenders}` : ''}
${hasVehicleExpense ? `Vehicle: ${vehicleBusinessPercent}% business use` : ''}
${hasTravelExpense ? 'Has business travel' : ''}
${hasMealsExpense ? `Business meals: ${mealsBusinessPercent}% of restaurant charges` : ''}

## PERSONAL / OWNER CONTEXT
Mixed personal/business account: ${hasMixedAccount ? 'YES' : 'NO'}
${hasMixedAccount ? `Personal vendors to EXCLUDE: ${primaryPersonalVendors}` : ''}
Owner compensation: ${ownerPaymentMethod} ${ownerDrawAmount ? `(~${ownerDrawAmount})` : ''}
${hasLargeSinglePayments ? `NOTE - Large one-time items: ${largeSinglePaymentDescription}` : ''}

## CLASSIFICATION RULES
1. Revenue: Money coming IN from business activities (credits from payment processors, client payments, etc.)
2. Cost of Goods Sold: Direct costs to produce product/service (inventory, direct labor, shipping)
3. Operating Expenses: Indirect business costs (rent, software, marketing, professional services, insurance)
4. Owner's Draw: Transfers to owner / self payments — these are NOT expenses, they are equity distributions
5. Personal: Items that are personal, not business. These should be excluded from the P&L.
6. Transfers: Internal transfers between accounts — NOT revenue or expenses
7. Loan payments: Separate principal (balance sheet) from interest (expense). If unclear, classify as "Debt Service"

P&L CATEGORIES to use:
Revenue: "Sales Revenue", "Service Revenue", "Other Income"
COGS: "Cost of Goods", "Direct Labor", "Shipping & Fulfillment"
Operating: "Software & Subscriptions", "Marketing & Advertising", "Rent & Facilities", "Professional Services", "Insurance", "Vehicle Expense", "Travel", "Meals & Entertainment", "Bank Fees", "Utilities", "Office Supplies", "Payroll & Wages", "Debt Service", "Other Operating"
Non-P&L: "Owner's Draw", "Personal", "Transfer", "Tax Payment"

## OUTPUT FORMAT
Return ONLY valid JSON array. Each item must have:
{
  "date": "YYYY-MM-DD",
  "description": "original description",
  "amount": number,
  "type": "credit" or "debit",
  "category": "Revenue" | "Cost of Goods Sold" | "Operating Expenses" | "Non-P&L",
  "subcategory": one of the P&L categories above,
  "isBusinessExpense": boolean,
  "confidence": 0.0-1.0
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { transactions, questionnaire } = await req.json();

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'Invalid transactions data' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(questionnaire || {});

    // Process in batches of 20
    const BATCH_SIZE = 20;
    const classified: unknown[] = [];

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            // @ts-ignore
            cache_control: { type: 'ephemeral' },
          },
        ] as Parameters<typeof anthropic.messages.create>[0]['system'],
        messages: [
          {
            role: 'user',
            content: `Classify these ${batch.length} transactions. Return only the JSON array:\n\n${JSON.stringify(batch, null, 2)}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') continue;

      try {
        const text = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
        const batchClassified = JSON.parse(text);
        classified.push(...batchClassified);
      } catch {
        // If JSON parse fails, add raw transactions with default classification
        classified.push(...batch.map((t: Record<string, unknown>) => ({
          ...t,
          category: t.type === 'credit' ? 'Revenue' : 'Operating Expenses',
          subcategory: t.type === 'credit' ? 'Sales Revenue' : 'Other Operating',
          isBusinessExpense: t.type === 'debit',
          confidence: 0.4,
        })));
      }
    }

    return NextResponse.json({ classified, count: classified.length });
  } catch (error) {
    console.error('Classification error:', error);
    return NextResponse.json(
      { error: 'Classification failed', classified: [] },
      { status: 500 }
    );
  }
}
