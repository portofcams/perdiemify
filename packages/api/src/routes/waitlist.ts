import { Router, Request, Response } from 'express';
import { Resend } from 'resend';

export const waitlistRouter = Router();

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory waitlist store for MVP (will be moved to DB)
const waitlistEmails: Set<string> = new Set();

/**
 * POST /api/waitlist — Add email to waitlist + send confirmation
 */
waitlistRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address required',
      });
    }

    // Deduplicate
    if (waitlistEmails.has(email.toLowerCase())) {
      return res.json({
        success: true,
        message: 'Already on the waitlist!',
      });
    }

    waitlistEmails.add(email.toLowerCase());
    console.log(`Waitlist signup: ${email} (total: ${waitlistEmails.size})`);

    // Send confirmation email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'Perdiemify <onboarding@resend.dev>',
          to: email,
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
        console.log(`Waitlist confirmation email sent to ${email}`);
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
waitlistRouter.get('/count', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: { count: waitlistEmails.size },
  });
});
