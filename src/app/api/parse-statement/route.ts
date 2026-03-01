import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PARSE_SYSTEM_PROMPT = `You are a financial data extraction specialist. Your task is to extract transaction data from bank statement text.

Extract ALL transactions from the provided bank statement text and return them as a JSON array.

For each transaction, extract:
- date: ISO date string (YYYY-MM-DD)
- description: The full transaction description/memo as it appears
- amount: Numeric amount (positive number)
- type: "credit" (money coming in) or "debit" (money going out)

Rules:
- Include ALL transactions, including fees, transfers, and adjustments
- Use the actual date shown, not posting date if both are listed
- Amount should always be positive — use "type" to indicate direction
- If a transaction description has "POS", "DEBIT", "CREDIT", "ACH", etc., keep those prefixes
- Exclude running balance entries (they are not transactions)
- Exclude statement headers, summaries, and metadata

Return ONLY a valid JSON array. No markdown, no explanation. Example:
[
  {"date":"2024-01-15","description":"SQ *COFFEE SHOP 01/15","amount":8.50,"type":"debit"},
  {"date":"2024-01-16","description":"STRIPE TRANSFER","amount":2450.00,"type":"credit"}
]`;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.messages.create as any)({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract all transactions from this bank statement. Return only the JSON array.',
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let transactions;
    try {
      const text = content.text.trim();
      const jsonText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      transactions = JSON.parse(jsonText);
    } catch {
      throw new Error('Failed to parse Claude response as JSON');
    }

    return NextResponse.json({ transactions, count: transactions.length });
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse bank statement', transactions: [] },
      { status: 500 }
    );
  }
}
