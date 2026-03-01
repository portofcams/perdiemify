/**
 * Receipts API Route — Phase 4
 *
 * Endpoints:
 *   POST   /api/receipts/upload          Upload receipt image, create DB record, queue OCR
 *   GET    /api/receipts                 List receipts (?tripId= filter)
 *   GET    /api/receipts/compliance      Per diem compliance summary (?tripId=)
 *   GET    /api/receipts/export/csv      Download CSV expense report (?tripId=&format=)
 *   GET    /api/receipts/export/pdf      Download PDF expense report (?tripId=)
 *   GET    /api/receipts/image/:key(*)   Serve receipt image (proxy from storage)
 *   GET    /api/receipts/:id             Get single receipt (for OCR polling)
 *   PATCH  /api/receipts/:id             Update/verify OCR data
 *   DELETE /api/receipts/:id             Remove receipt + storage file
 */

import { Router, Request, Response } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { users, receipts, trips, meals } from '../db/schema';
import { getStorage, getContentType, receiptStorageKey } from '../utils/storage';
import { ocrQueue } from '../queue/queues';
import { generateExpenseCsv, generateExpensePdf, CsvFormat } from '../services/expense-export';

export const receiptsRouter = Router();

// All receipt routes require auth
receiptsRouter.use(requireAuth);

// Multer config: memory storage, 10MB max, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP, HEIC) are allowed'));
    }
  },
});

/** Helper: look up internal user ID from Clerk ID */
async function getUserId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

// ─── POST /upload — Upload receipt image ─────────────────────────

receiptsRouter.post('/upload', upload.single('receipt'), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No receipt image provided' });
    }

    const tripId = req.body.tripId || null;

    // Verify trip ownership if tripId provided
    if (tripId) {
      const [trip] = await db
        .select({ userId: trips.userId })
        .from(trips)
        .where(eq(trips.id, tripId))
        .limit(1);

      if (!trip || trip.userId !== userId) {
        return res.status(404).json({ success: false, error: 'Trip not found' });
      }
    }

    // Create receipt record first (to get the ID for the storage key)
    const [receipt] = await db
      .insert(receipts)
      .values({
        userId,
        tripId,
        imageUrl: '', // Will be updated after storage upload
        status: 'processing',
      })
      .returning();

    // Upload to storage
    const storage = getStorage();
    const key = receiptStorageKey(userId, receipt.id, req.file.originalname);
    const contentType = getContentType(req.file.originalname);
    const imageUrl = await storage.upload(key, req.file.buffer, contentType);

    // Update receipt with storage info
    const [updated] = await db
      .update(receipts)
      .set({ imageUrl, storageKey: key })
      .where(eq(receipts.id, receipt.id))
      .returning();

    // Queue OCR processing
    await ocrQueue.add('ocr-receipt', {
      receiptId: receipt.id,
      storageKey: key,
    });

    console.log(`[Receipts] Uploaded receipt ${receipt.id} → queued OCR`);

    return res.status(201).json({ success: true, data: updated });
  } catch (err: unknown) {
    console.error('Upload receipt error:', err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large (max 10MB)' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to upload receipt' });
  }
});

// ─── GET / — List receipts ───────────────────────────────────────

receiptsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: [] });
    }

    const tripId = req.query.tripId as string | undefined;

    const conditions = tripId
      ? and(eq(receipts.userId, userId), eq(receipts.tripId, tripId))
      : eq(receipts.userId, userId);

    const userReceipts = await db
      .select()
      .from(receipts)
      .where(conditions)
      .orderBy(desc(receipts.createdAt));

    return res.json({ success: true, data: userReceipts });
  } catch (err) {
    console.error('List receipts error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list receipts' });
  }
});

// ─── GET /compliance — Per diem compliance summary ───────────────

receiptsRouter.get('/compliance', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.json({ success: true, data: { days: [], totals: {} } });
    }

    const tripId = req.query.tripId as string | undefined;
    if (!tripId) {
      return res.status(400).json({ success: false, error: 'tripId is required' });
    }

    // Get trip details
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const lodgingRate = Number(trip.lodgingRate);
    const mieRate = Number(trip.mieRate);

    // Get all receipts for this trip (only 'ready' or 'verified')
    const tripReceipts = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.userId, userId),
        eq(receipts.tripId, tripId),
      ));

    // Get all meals for this trip
    const tripMeals = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.tripId, tripId)));

    // Build daily breakdown
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const days: Array<{
      date: string;
      lodgingSpent: number;
      lodgingAllowance: number;
      mieSpent: number;
      mieAllowance: number;
      totalSpent: number;
      totalAllowance: number;
      delta: number;
    }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Sum lodging receipts for this date
      const lodgingSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory === 'lodging' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      // Sum meal expenses for this date (from receipts + meals table)
      const mealReceiptSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory === 'meals' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      const mealLogSpent = tripMeals
        .filter(m => m.date === dateStr)
        .reduce((s, m) => s + Number(m.amount), 0);

      const mieSpent = mealReceiptSpent + mealLogSpent;

      // Other expenses (transport, parking, etc.) count against total
      const otherSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory !== 'lodging' && r.ocrCategory !== 'meals' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      const totalSpent = lodgingSpent + mieSpent + otherSpent;
      const totalAllowance = lodgingRate + mieRate;

      days.push({
        date: dateStr,
        lodgingSpent: Math.round(lodgingSpent * 100) / 100,
        lodgingAllowance: lodgingRate,
        mieSpent: Math.round(mieSpent * 100) / 100,
        mieAllowance: mieRate,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalAllowance: Math.round(totalAllowance * 100) / 100,
        delta: Math.round((totalAllowance - totalSpent) * 100) / 100,
      });
    }

    // Totals
    const totalAllowance = days.reduce((s, d) => s + d.totalAllowance, 0);
    const totalSpent = days.reduce((s, d) => s + d.totalSpent, 0);

    return res.json({
      success: true,
      data: {
        trip: {
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          lodgingRate,
          mieRate,
        },
        days,
        totals: {
          totalAllowance: Math.round(totalAllowance * 100) / 100,
          totalSpent: Math.round(totalSpent * 100) / 100,
          delta: Math.round((totalAllowance - totalSpent) * 100) / 100,
          receiptCount: tripReceipts.length,
          verifiedCount: tripReceipts.filter(r => r.isVerified).length,
        },
      },
    });
  } catch (err) {
    console.error('Compliance summary error:', err);
    return res.status(500).json({ success: false, error: 'Failed to compute compliance' });
  }
});

// ─── GET /export/csv — Download CSV expense report ───────────────

receiptsRouter.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tripId = req.query.tripId as string | undefined;
    const format = (req.query.format as CsvFormat) || 'generic';

    if (!tripId) {
      return res.status(400).json({ success: false, error: 'tripId is required' });
    }

    // Get trip
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    // Get receipts and meals
    const tripReceipts = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.userId, userId), eq(receipts.tripId, tripId)));

    const tripMeals = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.tripId, tripId)));

    const csv = generateExpenseCsv(
      {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        lodgingRate: Number(trip.lodgingRate),
        mieRate: Number(trip.mieRate),
      },
      tripReceipts.map(r => ({
        ocrDate: r.ocrDate,
        ocrVendor: r.ocrVendor,
        ocrCategory: r.ocrCategory,
        ocrAmount: r.ocrAmount,
        isVerified: r.isVerified,
      })),
      tripMeals.map(m => ({
        date: m.date,
        mealType: m.mealType,
        vendor: m.vendor,
        amount: String(m.amount),
      })),
      format
    );

    const filename = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_expenses.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    return res.status(500).json({ success: false, error: 'Failed to export CSV' });
  }
});

// ─── GET /export/pdf — Download PDF expense report ───────────────

receiptsRouter.get('/export/pdf', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tripId = req.query.tripId as string | undefined;
    if (!tripId) {
      return res.status(400).json({ success: false, error: 'tripId is required' });
    }

    // Get trip
    const [trip] = await db
      .select()
      .from(trips)
      .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
      .limit(1);

    if (!trip) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const lodgingRate = Number(trip.lodgingRate);
    const mieRate = Number(trip.mieRate);

    // Get receipts and meals
    const tripReceipts = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.userId, userId), eq(receipts.tripId, tripId)));

    const tripMeals = await db
      .select()
      .from(meals)
      .where(and(eq(meals.userId, userId), eq(meals.tripId, tripId)));

    // Build compliance days for the PDF
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const complianceDays: Array<{
      date: string;
      lodgingSpent: number;
      lodgingAllowance: number;
      mieSpent: number;
      mieAllowance: number;
      totalSpent: number;
      totalAllowance: number;
      delta: number;
    }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      const lodgingSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory === 'lodging' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      const mealReceiptSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory === 'meals' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      const mealLogSpent = tripMeals
        .filter(m => m.date === dateStr)
        .reduce((s, m) => s + Number(m.amount), 0);

      const mieSpent = mealReceiptSpent + mealLogSpent;

      const otherSpent = tripReceipts
        .filter(r => r.ocrDate === dateStr && r.ocrCategory !== 'lodging' && r.ocrCategory !== 'meals' && (r.status === 'ready' || r.isVerified))
        .reduce((s, r) => s + (Number(r.ocrAmount) || 0), 0);

      const totalSpent = lodgingSpent + mieSpent + otherSpent;
      const totalAllowance = lodgingRate + mieRate;

      complianceDays.push({
        date: dateStr,
        lodgingSpent: Math.round(lodgingSpent * 100) / 100,
        lodgingAllowance: lodgingRate,
        mieSpent: Math.round(mieSpent * 100) / 100,
        mieAllowance: mieRate,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalAllowance: Math.round(totalAllowance * 100) / 100,
        delta: Math.round((totalAllowance - totalSpent) * 100) / 100,
      });
    }

    const pdfBuffer = await generateExpensePdf(
      {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        lodgingRate,
        mieRate,
      },
      complianceDays,
      tripReceipts.map(r => ({
        ocrDate: r.ocrDate,
        ocrVendor: r.ocrVendor,
        ocrCategory: r.ocrCategory,
        ocrAmount: r.ocrAmount,
        isVerified: r.isVerified,
      })),
      tripMeals.map(m => ({
        date: m.date,
        mealType: m.mealType,
        vendor: m.vendor,
        amount: String(m.amount),
      }))
    );

    const filename = `${trip.name.replace(/[^a-zA-Z0-9]/g, '_')}_expense_report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Export PDF error:', err);
    return res.status(500).json({ success: false, error: 'Failed to export PDF' });
  }
});

// ─── GET /image/:key(*) — Serve receipt image ───────────────────

receiptsRouter.get('/image/*', async (req: Request, res: Response) => {
  try {
    // Extract the full storage key from the wildcard path
    const storageKey = decodeURIComponent((req.params as Record<string, string>)[0]);

    if (!storageKey) {
      return res.status(400).json({ success: false, error: 'Missing image key' });
    }

    // Verify the requesting user owns this receipt
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const [receipt] = await db
      .select({ userId: receipts.userId })
      .from(receipts)
      .where(eq(receipts.storageKey, storageKey))
      .limit(1);

    if (!receipt || receipt.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Stream the image from storage
    const storage = getStorage();
    const buffer = await storage.getBuffer(storageKey);
    const contentType = getContentType(storageKey);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(buffer);
  } catch (err) {
    console.error('Serve receipt image error:', err);
    return res.status(500).json({ success: false, error: 'Failed to serve image' });
  }
});

// ─── GET /:id — Get single receipt ───────────────────────────────

receiptsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, req.params.id as string))
      .limit(1);

    if (!receipt || receipt.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    return res.json({ success: true, data: receipt });
  } catch (err) {
    console.error('Get receipt error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get receipt' });
  }
});

// ─── PATCH /:id — Update / verify OCR data ──────────────────────

receiptsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const [existing] = await db
      .select({ userId: receipts.userId })
      .from(receipts)
      .where(eq(receipts.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const { ocrVendor, ocrAmount, ocrDate, ocrCategory, isVerified, tripId } = req.body;
    const updateFields: Record<string, unknown> = {};

    if (ocrVendor !== undefined) updateFields.ocrVendor = ocrVendor;
    if (ocrAmount !== undefined) updateFields.ocrAmount = ocrAmount != null ? String(ocrAmount) : null;
    if (ocrDate !== undefined) updateFields.ocrDate = ocrDate;
    if (ocrCategory !== undefined) updateFields.ocrCategory = ocrCategory;
    if (isVerified !== undefined) updateFields.isVerified = isVerified;
    if (tripId !== undefined) updateFields.tripId = tripId;

    const [updated] = await db
      .update(receipts)
      .set(updateFields)
      .where(eq(receipts.id, req.params.id as string))
      .returning();

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update receipt error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update receipt' });
  }
});

// ─── DELETE /:id — Remove receipt + storage file ─────────────────

receiptsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const [existing] = await db
      .select({ userId: receipts.userId, storageKey: receipts.storageKey })
      .from(receipts)
      .where(eq(receipts.id, req.params.id as string))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    // Remove from storage
    if (existing.storageKey) {
      try {
        const storage = getStorage();
        await storage.delete(existing.storageKey);
      } catch (storageErr) {
        console.warn(`[Receipts] Failed to delete storage for ${req.params.id}:`, storageErr);
        // Continue anyway — DB record should still be removed
      }
    }

    // Remove from DB
    await db.delete(receipts).where(eq(receipts.id, req.params.id as string));

    return res.json({ success: true, message: 'Receipt deleted' });
  } catch (err) {
    console.error('Delete receipt error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete receipt' });
  }
});
