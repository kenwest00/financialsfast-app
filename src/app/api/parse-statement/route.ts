import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TextractClient, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

// ─── Clients ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const textract = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// ─── Prompts ─────────────────────────────────────────────────────────────────

const PARSE_STRUCTURED_PROMPT = `You are a financial data extraction specialist. You will receive structured table data extracted from a bank statement via OCR.

The data is organized as rows from detected tables. Each row contains cells with text values representing columns like date, description, debit, credit, and balance.

Extract ALL transactions and return them as a JSON array.

For each transaction, extract:
- date: ISO date string (YYYY-MM-DD)
- description: The full transaction description/memo
- amount: Numeric amount (positive number, no $ or commas)
- type: "credit" (money in — deposits, transfers in) or "debit" (money out — purchases, fees, withdrawals)

Rules:
- Include ALL transactions: purchases, deposits, fees, transfers, ACH, POS, ATM, etc.
- Amount should always be positive — use "type" to indicate direction
- If a row has a value in a "debit" or "withdrawal" column, it's a debit
- If a row has a value in a "credit" or "deposit" column, it's a credit
- Skip header rows, summary rows, totals, and running balance-only rows
- If the date column is empty but other fields have data, use the most recent date above it
- Parse dates intelligently: "01/15/24" → "2024-01-15", "Jan 15" → use the statement year

Return ONLY a valid JSON array. No markdown, no explanation.`;

const PARSE_FALLBACK_PROMPT = `You are a financial data extraction specialist. Your task is to extract transaction data from bank statement text.

Extract ALL transactions from the provided bank statement and return them as a JSON array.

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

Return ONLY a valid JSON array. No markdown, no explanation.`;

// ─── Textract helpers ────────────────────────────────────────────────────────

interface TextractTable {
  headers: string[];
  rows: string[][];
}

function extractTablesFromTextract(response: Record<string, unknown>): { tables: TextractTable[]; rawText: string } {
  const blocks = (response.Blocks || []) as Array<Record<string, unknown>>;

  // Build block ID lookup
  const blockMap = new Map<string, Record<string, unknown>>();
  for (const block of blocks) {
    blockMap.set(block.Id as string, block);
  }

  // Extract raw text (LINE blocks) as fallback
  const lines = blocks
    .filter((b) => b.BlockType === 'LINE')
    .map((b) => b.Text as string)
    .filter(Boolean);
  const rawText = lines.join('\n');

  // Extract tables
  const tables: TextractTable[] = [];
  const tableBlocks = blocks.filter((b) => b.BlockType === 'TABLE');

  for (const table of tableBlocks) {
    const relationships = (table.Relationships || []) as Array<Record<string, unknown>>;
    const childRel = relationships.find((r) => r.Type === 'CHILD');
    if (!childRel) continue;

    const cellIds = (childRel.Ids || []) as string[];
    const cells: Array<{ row: number; col: number; text: string }> = [];

    for (const cellId of cellIds) {
      const cell = blockMap.get(cellId);
      if (!cell || cell.BlockType !== 'CELL') continue;

      const rowIndex = cell.RowIndex as number;
      const colIndex = cell.ColumnIndex as number;

      // Get cell text from child WORD blocks
      const cellRels = (cell.Relationships || []) as Array<Record<string, unknown>>;
      const cellChildRel = cellRels.find((r) => r.Type === 'CHILD');
      let text = '';
      if (cellChildRel) {
        const wordIds = (cellChildRel.Ids || []) as string[];
        const words = wordIds
          .map((id) => blockMap.get(id))
          .filter(Boolean)
          .map((b) => (b as Record<string, unknown>).Text as string)
          .filter(Boolean);
        text = words.join(' ');
      }

      cells.push({ row: rowIndex, col: colIndex, text: text.trim() });
    }

    if (cells.length === 0) continue;

    // Organize into rows
    const maxRow = Math.max(...cells.map((c) => c.row));
    const maxCol = Math.max(...cells.map((c) => c.col));
    const grid: string[][] = [];
    for (let r = 1; r <= maxRow; r++) {
      const row: string[] = [];
      for (let c = 1; c <= maxCol; c++) {
        const cell = cells.find((ce) => ce.row === r && ce.col === c);
        row.push(cell?.text || '');
      }
      grid.push(row);
    }

    // First row is typically headers
    if (grid.length > 1) {
      tables.push({
        headers: grid[0],
        rows: grid.slice(1),
      });
    } else if (grid.length === 1) {
      tables.push({
        headers: grid[0],
        rows: [],
      });
    }
  }

  return { tables, rawText };
}

function formatTablesForClaude(tables: TextractTable[]): string {
  if (tables.length === 0) return '';

  let output = '';
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    output += `--- TABLE ${i + 1} ---\n`;
    output += `HEADERS: ${table.headers.join(' | ')}\n`;
    for (const row of table.rows) {
      output += row.join(' | ') + '\n';
    }
    output += '\n';
  }
  return output;
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    let transactions;
    let extractionMethod: 'textract' | 'claude-direct' = 'claude-direct';

    // ── Try Textract first ──────────────────────────────────────────────────
    const hasAwsCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

    if (hasAwsCreds) {
      try {
        const textractCommand = new AnalyzeDocumentCommand({
          Document: { Bytes: bytes },
          FeatureTypes: ['TABLES'],
        });

        const textractResponse = await textract.send(textractCommand);
        const { tables, rawText } = extractTablesFromTextract(
          textractResponse as unknown as Record<string, unknown>
        );

        if (tables.length > 0 && tables.some((t) => t.rows.length > 0)) {
          // Textract found tables — send structured data to Claude
          extractionMethod = 'textract';
          const tableText = formatTablesForClaude(tables);

          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250514',
            max_tokens: 8192,
            system: PARSE_STRUCTURED_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Here is structured table data extracted from a bank statement via OCR:\n\n${tableText}\n\nExtract all transactions as a JSON array.`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type === 'text') {
            const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
            transactions = JSON.parse(jsonText);
          }
        } else if (rawText.length > 100) {
          // Textract found text but no tables — send raw text to Claude
          extractionMethod = 'textract';

          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250514',
            max_tokens: 8192,
            system: PARSE_FALLBACK_PROMPT,
            messages: [
              {
                role: 'user',
                content: `Here is text extracted from a bank statement via OCR:\n\n${rawText}\n\nExtract all transactions as a JSON array.`,
              },
            ],
          });

          const content = response.content[0];
          if (content.type === 'text') {
            const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
            transactions = JSON.parse(jsonText);
          }
        }
        // If Textract returned nothing useful, fall through to direct Claude
      } catch (textractError) {
        console.error('Textract extraction failed, falling back to Claude direct:', textractError);
        // Fall through to Claude direct method
      }
    }

    // ── Fallback: send PDF directly to Claude ───────────────────────────────
    if (!transactions) {
      extractionMethod = 'claude-direct';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (anthropic.messages.create as any)({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 8192,
        system: PARSE_FALLBACK_PROMPT,
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

      const jsonText = content.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      transactions = JSON.parse(jsonText);
    }

    return NextResponse.json({
      transactions,
      count: transactions.length,
      extractionMethod,
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse bank statement', transactions: [] },
      { status: 500 }
    );
  }
}
