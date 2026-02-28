/**
 * Expense Export Service — Phase 4
 *
 * Generates PDF and CSV expense reports for a trip,
 * combining receipt + meal data with per diem compliance.
 */

import PDFDocument from 'pdfkit';

// ─── Types ───────────────────────────────────────────────────────

interface TripData {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  lodgingRate: number;
  mieRate: number;
}

interface ReceiptRow {
  ocrDate: string | null;
  ocrVendor: string | null;
  ocrCategory: string | null;
  ocrAmount: string | null;
  isVerified: boolean;
}

interface MealRow {
  date: string;
  mealType: string;
  vendor: string | null;
  amount: string;
}

interface ComplianceDay {
  date: string;
  lodgingSpent: number;
  lodgingAllowance: number;
  mieSpent: number;
  mieAllowance: number;
  totalSpent: number;
  totalAllowance: number;
  delta: number;
}

// ─── CSV Export ──────────────────────────────────────────────────

export type CsvFormat = 'generic' | 'concur' | 'expensify';

export function generateExpenseCsv(
  trip: TripData,
  receiptRows: ReceiptRow[],
  mealRows: MealRow[],
  format: CsvFormat = 'generic'
): string {
  // Merge all expenses into a unified list sorted by date
  const expenses: Array<{
    date: string;
    vendor: string;
    category: string;
    amount: number;
    hasReceipt: boolean;
    notes: string;
  }> = [];

  for (const r of receiptRows) {
    expenses.push({
      date: r.ocrDate || '',
      vendor: r.ocrVendor || 'Unknown',
      category: r.ocrCategory || 'other',
      amount: Number(r.ocrAmount) || 0,
      hasReceipt: true,
      notes: r.isVerified ? 'Verified' : 'Unverified',
    });
  }

  for (const m of mealRows) {
    expenses.push({
      date: m.date,
      vendor: m.vendor || 'Unknown',
      category: 'meals',
      amount: Number(m.amount),
      hasReceipt: false,
      notes: m.mealType,
    });
  }

  expenses.sort((a, b) => a.date.localeCompare(b.date));

  switch (format) {
    case 'concur':
      return generateConcurCsv(trip, expenses);
    case 'expensify':
      return generateExpensifyCsv(trip, expenses);
    default:
      return generateGenericCsv(trip, expenses);
  }
}

interface ExpenseLine {
  date: string;
  vendor: string;
  category: string;
  amount: number;
  hasReceipt: boolean;
  notes: string;
}

function generateGenericCsv(trip: TripData, expenses: ExpenseLine[]): string {
  const rows: string[] = [];
  rows.push(`"Trip","${trip.name} — ${trip.destination}"`);
  rows.push(`"Dates","${trip.startDate} to ${trip.endDate}"`);
  rows.push(`"Lodging Rate","$${trip.lodgingRate}/night"`);
  rows.push(`"M&IE Rate","$${trip.mieRate}/day"`);
  rows.push('');
  rows.push('"Date","Vendor","Category","Amount","Receipt","Notes"');

  for (const e of expenses) {
    rows.push(
      `"${e.date}","${csvEscape(e.vendor)}","${e.category}","${e.amount.toFixed(2)}","${e.hasReceipt ? 'Yes' : 'No'}","${csvEscape(e.notes)}"`
    );
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  rows.push('');
  rows.push(`"","","Total","${total.toFixed(2)}","",""`);

  return rows.join('\n');
}

function generateConcurCsv(trip: TripData, expenses: ExpenseLine[]): string {
  const rows: string[] = [];
  rows.push('"Report Name","Report Date","Expense Type","Transaction Date","Vendor","Amount","Receipt","Personal","Comment"');

  const reportName = `${trip.name} - ${trip.destination}`;
  const reportDate = new Date().toISOString().split('T')[0];

  for (const e of expenses) {
    const expenseType = mapConcurCategory(e.category);
    rows.push(
      `"${csvEscape(reportName)}","${reportDate}","${expenseType}","${e.date}","${csvEscape(e.vendor)}","${e.amount.toFixed(2)}","${e.hasReceipt ? 'Y' : 'N'}","N","${csvEscape(e.notes)}"`
    );
  }

  return rows.join('\n');
}

function generateExpensifyCsv(trip: TripData, expenses: ExpenseLine[]): string {
  const rows: string[] = [];
  rows.push('"Merchant","Date","Amount","Category","Tag","Comment","Reimbursable"');

  for (const e of expenses) {
    rows.push(
      `"${csvEscape(e.vendor)}","${e.date}","${e.amount.toFixed(2)}","${e.category}","${csvEscape(trip.name)}","${csvEscape(e.notes)}","yes"`
    );
  }

  return rows.join('\n');
}

function mapConcurCategory(category: string): string {
  const map: Record<string, string> = {
    lodging: 'Hotel',
    meals: 'Meals',
    transport: 'Transportation',
    parking: 'Parking',
    tips: 'Tips',
    other: 'Miscellaneous',
  };
  return map[category] || 'Miscellaneous';
}

function csvEscape(value: string): string {
  return value.replace(/"/g, '""');
}

// ─── PDF Export ──────────────────────────────────────────────────

export async function generateExpensePdf(
  trip: TripData,
  complianceDays: ComplianceDay[],
  receiptRows: ReceiptRow[],
  mealRows: MealRow[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──
    doc.fontSize(20).fillColor('#047857').text('Perdiemify', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor('#111827').text('Expense Report', { align: 'center' });
    doc.moveDown(0.5);

    // ── Trip details ──
    doc.fontSize(11).fillColor('#374151');
    doc.text(`Trip: ${trip.name}`, { continued: true }).text(`   |   Destination: ${trip.destination}`);
    doc.text(`Dates: ${trip.startDate} to ${trip.endDate}`);
    doc.text(`Lodging Rate: $${trip.lodgingRate}/night   |   M&IE Rate: $${trip.mieRate}/day`);
    doc.moveDown(0.5);

    // ── Compliance summary ──
    const totalAllowance = complianceDays.reduce((s, d) => s + d.totalAllowance, 0);
    const totalSpent = complianceDays.reduce((s, d) => s + d.totalSpent, 0);
    const totalDelta = totalAllowance - totalSpent;

    doc
      .rect(50, doc.y, 512, 45)
      .fill(totalDelta >= 0 ? '#f0fdf4' : '#fef2f2');

    doc.fillColor(totalDelta >= 0 ? '#047857' : '#dc2626');
    doc.fontSize(12).text(
      `Total Allowance: $${totalAllowance.toFixed(2)}   |   Total Spent: $${totalSpent.toFixed(2)}   |   ${totalDelta >= 0 ? 'Savings' : 'Over Budget'}: $${Math.abs(totalDelta).toFixed(2)}`,
      60,
      doc.y - 35,
      { align: 'center', width: 492 }
    );
    doc.y += 20;
    doc.moveDown(1);

    // ── Daily breakdown table ──
    doc.fontSize(13).fillColor('#111827').text('Daily Breakdown', { underline: true });
    doc.moveDown(0.3);

    const tableHeaders = ['Date', 'Lodging', 'L. Rate', 'M&IE', 'M&IE Rate', 'Total', 'Delta'];
    const colWidths = [75, 65, 60, 60, 65, 65, 65];
    let xPos = 55;

    // Header row
    doc.fontSize(9).fillColor('#6b7280');
    tableHeaders.forEach((h, i) => {
      doc.text(h, xPos, doc.y, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
      xPos += colWidths[i] + 5;
    });
    doc.moveDown(0.5);

    // Data rows
    for (const day of complianceDays) {
      xPos = 55;
      doc.fontSize(9).fillColor('#374151');
      const vals = [
        day.date,
        `$${day.lodgingSpent.toFixed(0)}`,
        `$${day.lodgingAllowance.toFixed(0)}`,
        `$${day.mieSpent.toFixed(2)}`,
        `$${day.mieAllowance.toFixed(2)}`,
        `$${day.totalSpent.toFixed(2)}`,
      ];
      vals.forEach((v, i) => {
        doc.text(v, xPos, doc.y, { width: colWidths[i], align: i === 0 ? 'left' : 'right' });
        xPos += colWidths[i] + 5;
      });
      // Delta column with color
      const delta = day.delta;
      doc.fillColor(delta >= 0 ? '#047857' : '#dc2626');
      doc.text(`${delta >= 0 ? '+' : ''}$${delta.toFixed(2)}`, xPos, doc.y, { width: colWidths[6], align: 'right' });
      doc.fillColor('#374151');
      doc.moveDown(0.3);

      // Page break check
      if (doc.y > 680) {
        doc.addPage();
      }
    }

    doc.moveDown(1);

    // ── Line items ──
    doc.fontSize(13).fillColor('#111827').text('Expense Line Items', { underline: true });
    doc.moveDown(0.3);

    // Combine all expenses
    const allExpenses: Array<{ date: string; vendor: string; category: string; amount: number; source: string }> = [];

    for (const r of receiptRows) {
      allExpenses.push({
        date: r.ocrDate || 'N/A',
        vendor: r.ocrVendor || 'Unknown',
        category: r.ocrCategory || 'other',
        amount: Number(r.ocrAmount) || 0,
        source: 'Receipt',
      });
    }

    for (const m of mealRows) {
      allExpenses.push({
        date: m.date,
        vendor: m.vendor || 'Unknown',
        category: 'meals',
        amount: Number(m.amount),
        source: `Meal (${m.mealType})`,
      });
    }

    allExpenses.sort((a, b) => a.date.localeCompare(b.date));

    // Table header
    const itemHeaders = ['Date', 'Vendor', 'Category', 'Amount', 'Source'];
    const itemWidths = [75, 150, 80, 75, 100];
    xPos = 55;
    doc.fontSize(9).fillColor('#6b7280');
    itemHeaders.forEach((h, i) => {
      doc.text(h, xPos, doc.y, { width: itemWidths[i], align: i >= 3 ? 'right' : 'left' });
      xPos += itemWidths[i] + 5;
    });
    doc.moveDown(0.5);

    for (const e of allExpenses) {
      xPos = 55;
      doc.fontSize(9).fillColor('#374151');
      const vals = [e.date, e.vendor.slice(0, 30), e.category, `$${e.amount.toFixed(2)}`, e.source];
      vals.forEach((v, i) => {
        doc.text(v, xPos, doc.y, { width: itemWidths[i], align: i >= 3 ? 'right' : 'left' });
        xPos += itemWidths[i] + 5;
      });
      doc.moveDown(0.3);

      if (doc.y > 700) {
        doc.addPage();
      }
    }

    // ── Footer ──
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#9ca3af').text(
      `Generated by Perdiemify on ${new Date().toISOString().split('T')[0]}`,
      { align: 'center' }
    );

    doc.end();
  });
}
