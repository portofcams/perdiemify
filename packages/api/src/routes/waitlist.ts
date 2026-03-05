import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { validateBody } from '../middleware/validate';
import { waitlistSchema } from '@perdiemify/shared';
import { db } from '../db';
import { waitlistEmails } from '../db/schema';

export const waitlistRouter = Router();

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not configured');
    _resend = new Resend(key);
  }
  return _resend;
}

/**
 * POST /api/waitlist — Add email to waitlist + send confirmation
 */
waitlistRouter.post('/', validateBody(waitlistSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already on waitlist
    const [existing] = await db
      .select({ id: waitlistEmails.id })
      .from(waitlistEmails)
      .where(eq(waitlistEmails.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return res.json({
        success: true,
        message: 'Already on the waitlist!',
      });
    }

    // Insert into DB
    await db.insert(waitlistEmails).values({
      email: normalizedEmail,
      source: 'website',
    });

    console.log(`Waitlist signup: ${normalizedEmail}`);

    // Send confirmation email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        await getResend().emails.send({
          from: 'Perdiemify <onboarding@resend.dev>',
          to: normalizedEmail,
          subject: "You're on the Perdiemify waitlist! 🎉",
          html: `
            <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #10b981; font-size: 28px; margin-bottom: 16px;">Welcome to Perdiemify!</h1>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                You're on the waitlist. We'll notify you the moment we launch.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                In the meantime, you can already try our <a href="https://perdiemify.com/search" style="color: #10b981; font-weight: 600;">free search tool</a> to compare hotel prices against your per diem rates.
              </p>
              <div style="margin-top: 32px; padding: 20px; background: #f0fdf4; border-radius: 12px;">
                <p style="color: #047857; font-size: 14px; font-weight: 600; margin: 0;">
                  💡 Average per diem traveler saves $4,200/year with Perdiemify
                </p>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
                Perdiemify — Travel smart. Keep the difference.
              </p>
            </div>
          `,
        });
        console.log(`Waitlist confirmation email sent to ${normalizedEmail}`);
      } catch (emailErr) {
        console.error('Failed to send waitlist email:', emailErr);
        // Don't fail the request if email fails — user is still on the list
      }
    }

    return res.json({
      success: true,
      message: 'Added to waitlist! Check your email for confirmation.',
    });
  } catch (err) {
    console.error('Waitlist error:', err);
    return res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

/**
 * GET /api/waitlist/count — Public count of waitlist signups
 */
waitlistRouter.get('/count', async (_req: Request, res: Response) => {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(waitlistEmails);

    return res.json({
      success: true,
      data: { count: result?.count ?? 0 },
    });
  } catch (err) {
    console.error('Waitlist count error:', err);
    return res.json({
      success: true,
      data: { count: 0 },
    });
  }
});
