/**
 * Price Monitor Service — Phase 5 Feature 2
 *
 * Checks hotel prices for active price alerts and emails users
 * when a price drops below their per diem lodging rate (target_price).
 */

import { Resend } from 'resend';
import { eq, and, lte, or, isNull } from 'drizzle-orm';
import { db } from '../db';
import { priceAlerts, users } from '../db/schema';
import { searchHotels } from '../providers/amadeus';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not configured');
    _resend = new Resend(key);
  }
  return _resend;
}
const FROM_EMAIL = process.env.RESEND_FROM || 'Perdiemify <alerts@perdiemify.com>';

export async function checkAllPriceAlerts(): Promise<{ checked: number; alertsSent: number }> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get active alerts that haven't been checked in the last 6 hours
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  const activeAlerts = await db
    .select()
    .from(priceAlerts)
    .where(
      and(
        eq(priceAlerts.isActive, true),
        or(
          isNull(priceAlerts.lastChecked),
          lte(priceAlerts.lastChecked, sixHoursAgo),
        ),
      )
    );

  let checked = 0;
  let alertsSent = 0;

  for (const alert of activeAlerts) {
    try {
      // Skip if check-in is in the past
      if (new Date(alert.checkIn) < now) {
        await db.update(priceAlerts).set({ isActive: false }).where(eq(priceAlerts.id, alert.id));
        continue;
      }

      const results = await searchHotels({
        destination: alert.destination,
        destinationState: alert.destinationState || undefined,
        checkIn: alert.checkIn,
        checkOut: alert.checkOut,
        type: 'hotel',
      });

      checked++;

      if (results.length === 0) {
        await db.update(priceAlerts).set({ lastChecked: now }).where(eq(priceAlerts.id, alert.id));
        continue;
      }

      const bestResult = results[0]; // Already sorted by price ascending
      const targetPrice = parseFloat(alert.targetPrice);

      await db.update(priceAlerts).set({
        lastChecked: now,
        currentBest: String(bestResult.pricePerNight),
        currentProvider: bestResult.name,
      }).where(eq(priceAlerts.id, alert.id));

      // Send alert if price is below target and hasn't alerted in 24h
      if (bestResult.pricePerNight <= targetPrice) {
        const canAlert = !alert.lastAlertSent || new Date(alert.lastAlertSent) < twentyFourHoursAgo;

        if (canAlert) {
          const sent = await sendPriceDropEmail(alert.userId, {
            destination: alert.destination,
            checkIn: alert.checkIn,
            checkOut: alert.checkOut,
            targetPrice,
            currentPrice: bestResult.pricePerNight,
            hotelName: bestResult.name,
            savings: targetPrice - bestResult.pricePerNight,
          });

          if (sent) {
            await db.update(priceAlerts).set({ lastAlertSent: now }).where(eq(priceAlerts.id, alert.id));
            alertsSent++;
          }
        }
      }
    } catch (err: unknown) {
      console.warn(`[PriceMonitor] Failed to check alert ${alert.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return { checked, alertsSent };
}

interface PriceDropInfo {
  destination: string;
  checkIn: string;
  checkOut: string;
  targetPrice: number;
  currentPrice: number;
  hotelName: string;
  savings: number;
}

async function sendPriceDropEmail(userId: string, info: PriceDropInfo): Promise<boolean> {
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return false;

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 24px 32px; border-radius: 16px 16px 0 0;">
        <h1 style="color: white; font-size: 22px; margin: 0;">Price Drop Alert!</h1>
        <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0;">
          A hotel in ${info.destination} just dropped below your per diem rate.
        </p>
      </div>
      <div style="background: white; padding: 24px 32px; border: 1px solid #e5e7eb; border-top: 0;">
        <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
          <p style="color: #1e40af; font-size: 24px; font-weight: 700; margin: 0;">
            $${info.currentPrice.toFixed(2)}/night
          </p>
          <p style="color: #3b82f6; font-size: 14px; margin: 4px 0 0;">
            ${info.hotelName}
          </p>
        </div>
        <table style="width: 100%; font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Per Diem Rate:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">$${info.targetPrice.toFixed(2)}/night</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Hotel Price:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #059669;">$${info.currentPrice.toFixed(2)}/night</td>
          </tr>
          <tr style="border-top: 2px solid #e5e7eb;">
            <td style="padding: 12px 0; color: #6b7280; font-weight: 600;">You Save:</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 18px; color: #059669;">$${info.savings.toFixed(2)}/night</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 13px; margin-top: 12px;">
          Dates: ${info.checkIn} to ${info.checkOut}
        </p>
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://perdiemify.com/dashboard/alerts" style="display: inline-block; padding: 12px 28px; background: #2563eb; color: white; font-weight: 600; text-decoration: none; border-radius: 12px; font-size: 14px;">
            View Alert Details
          </a>
        </div>
      </div>
      <div style="padding: 16px 32px; text-align: center; border-radius: 0 0 16px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          <a href="https://perdiemify.com/dashboard/alerts" style="color: #3b82f6;">Manage your alerts</a>
        </p>
      </div>
    </div>
  `;

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Price Drop: ${info.hotelName} in ${info.destination} — $${info.currentPrice.toFixed(2)}/night`,
      html,
    });
    return true;
  } catch (err: unknown) {
    console.warn(`[PriceMonitor] Failed to send email to ${user.email}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
