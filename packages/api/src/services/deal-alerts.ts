import { Resend } from 'resend';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not configured');
    _resend = new Resend(key);
  }
  return _resend;
}
const FROM_EMAIL = process.env.RESEND_FROM || 'Perdiemify <deals@perdiemify.com>';

interface DealAlert {
  code: string;
  provider: string;
  type: string;
  value: number | null;
  description: string | null;
  applicableTo: string;
}

/**
 * Send deal alert emails to Pro+ users when new codes are found.
 * Called by the scraper after upserting new codes.
 */
export async function sendDealAlerts(newDeals: DealAlert[]): Promise<number> {
  if (newDeals.length === 0) return 0;

  // Get Pro+ users (they get deal alerts)
  const proPlusUsers = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.subscriptionTier, 'proplus'));

  if (proPlusUsers.length === 0) return 0;

  // Build email content
  const dealRows = newDeals
    .slice(0, 10) // Max 10 deals per email
    .map((d) => {
      const valueStr = d.type === 'percent' && d.value ? `${d.value}% off` :
                       d.type === 'fixed' && d.value ? `$${d.value} off` : 'Special rate';
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            <strong style="color: #111827; font-size: 14px;">${d.code}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            <span style="color: #374151; font-size: 14px;">${d.provider}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            <span style="color: #10b981; font-weight: 600; font-size: 14px;">${valueStr}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
            <span style="color: #6b7280; font-size: 13px;">${d.applicableTo}</span>
          </td>
        </tr>`;
    })
    .join('');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #047857, #10b981); padding: 24px 32px; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; font-size: 22px; margin: 0;">New Travel Deals Found</h1>
        <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0;">
          ${newDeals.length} new discount code${newDeals.length !== 1 ? 's' : ''} just discovered by our scraper.
        </p>
      </div>
      <div style="background: white; padding: 24px 32px; border: 1px solid #e5e7eb; border-top: 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600;">Code</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600;">Provider</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600;">Discount</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${dealRows}
          </tbody>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://perdiemify.com/dashboard/deals" style="display: inline-block; padding: 12px 28px; background: #10b981; color: white; font-weight: 600; text-decoration: none; border-radius: 12px; font-size: 14px;">
            View All Deals
          </a>
        </div>
      </div>
      <div style="padding: 16px 32px; text-align: center; border-radius: 0 0 16px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          You're receiving this because you have a Pro+ subscription.
          <a href="https://perdiemify.com/dashboard/billing" style="color: #10b981;">Manage preferences</a>
        </p>
      </div>
    </div>
  `;

  let sent = 0;

  for (const user of proPlusUsers) {
    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: `${newDeals.length} New Travel Deal${newDeals.length !== 1 ? 's' : ''} Found — Perdiemify`,
        html,
      });
      sent++;
    } catch (err) {
      console.warn(`Failed to send deal alert to ${user.email}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Deal Alerts] Sent ${sent}/${proPlusUsers.length} emails for ${newDeals.length} new deals`);
  return sent;
}
