import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { billingCheckoutSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users } from '../db/schema';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, {
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

export const billingRouter = Router();

/**
 * POST /api/billing/create-checkout — Create a Stripe Checkout session
 *
 * Body: { plan: 'pro' | 'proplus' }
 */
billingRouter.post('/create-checkout', requireAuth, validateBody(billingCheckoutSchema), async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    const clerkId = req.auth!.userId;
    const email = req.auth!.email;

    // Get or create the price from the Stripe product
    const productId = plan === 'pro'
      ? process.env.STRIPE_PRO_PRODUCT_ID
      : process.env.STRIPE_PROPLUS_PRODUCT_ID;

    if (!productId) {
      return res.status(500).json({
        success: false,
        error: `Stripe product not configured for ${plan} plan.`,
      });
    }

    // Try env price ID first, otherwise look up from product
    let priceId = plan === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_PROPLUS_PRICE_ID;

    if (!priceId) {
      // Auto-discover price from the product
      const prices = await getStripe().prices.list({
        product: productId,
        active: true,
        type: 'recurring',
        limit: 1,
      });

      if (prices.data.length > 0) {
        priceId = prices.data[0].id;
        console.log(`Auto-discovered price ID for ${plan}: ${priceId}`);
      } else {
        // Create a default price if none exists
        const amount = plan === 'pro' ? 999 : 1999;
        const price = await getStripe().prices.create({
          product: productId,
          unit_amount: amount,
          currency: 'usd',
          recurring: { interval: 'month' },
        });
        priceId = price.id;
        console.log(`Created new price for ${plan}: ${priceId} ($${amount / 100}/mo)`);
      }
    }

    // Check if user already has a Stripe customer ID in DB
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: clerkId,
      metadata: {
        clerkId,
        plan,
      },
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/dashboard/billing?cancelled=true`,
    };

    // If we have a Stripe customer ID, use it; otherwise use email
    if (user?.stripeCustomerId) {
      sessionConfig.customer = user.stripeCustomerId;
    } else {
      sessionConfig.customer_email = email;
    }

    const session = await getStripe().checkout.sessions.create(sessionConfig);

    return res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (err) {
    console.error('Checkout creation error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout';
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/billing/portal — Create a Stripe Customer Portal session
 * (manage subscription, cancel, update payment method)
 */
billingRouter.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;

    // Look up stripeCustomerId from DB
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    const customerId = user?.stripeCustomerId;

    if (!customerId) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found. Please subscribe first.',
        redirectUrl: '/dashboard/billing',
      });
    }

    const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    return res.json({
      success: true,
      data: {
        portalUrl: portalSession.url,
      },
    });
  } catch (err) {
    console.error('Portal creation error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create portal session';
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/billing/webhook — Stripe webhook handler
 * Handles subscription lifecycle events.
 */
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret && sig) {
      // Verify webhook signature in production
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (rawBody) {
        event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
      } else {
        // Fallback: trust the payload (only for development)
        event = req.body as Stripe.Event;
      }
    } else {
      // No webhook secret = development mode
      event = req.body as Stripe.Event;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  console.log(`Stripe webhook: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkId = session.metadata?.clerkId || session.client_reference_id;
      const plan = session.metadata?.plan || 'pro';

      console.log(`Checkout completed: ${clerkId} → ${plan} plan`);

      if (clerkId) {
        await db
          .update(users)
          .set({
            subscriptionTier: plan,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId));

        console.log(`DB updated: ${clerkId} → tier=${plan}, customer=${session.customer}`);
      }

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status;

      console.log(`Subscription updated: ${subscription.id} → status: ${status}`);

      // Map Stripe status to our tier logic
      if (status === 'active' || status === 'trialing') {
        // Subscription is healthy — ensure tier matches the plan
        const priceId = subscription.items.data[0]?.price?.id;
        let tier = 'pro';
        if (priceId === process.env.STRIPE_PROPLUS_PRICE_ID) {
          tier = 'proplus';
        }

        await db
          .update(users)
          .set({ subscriptionTier: tier, updatedAt: new Date() })
          .where(eq(users.stripeSubscriptionId, subscription.id));

        console.log(`DB tier updated for subscription ${subscription.id} → ${tier}`);
      } else if (status === 'past_due' || status === 'unpaid') {
        // Keep the tier for now but log the issue
        console.warn(`Subscription ${subscription.id} is ${status} — user still has access but needs to pay`);
      }

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      console.log(`Subscription cancelled: ${subscription.id}`);

      // Downgrade user to free tier
      await db
        .update(users)
        .set({
          subscriptionTier: 'free',
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(users.stripeSubscriptionId, subscription.id));

      console.log(`DB downgraded user for cancelled subscription ${subscription.id}`);

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Payment failed for invoice: ${invoice.id}`);

      // Log the event — email notification can be added later via Resend
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  return res.json({ received: true });
});

/**
 * GET /api/billing/status — Get current subscription status
 */
billingRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const clerkId = req.auth!.userId;

    // Look up from DB
    const [user] = await db
      .select({
        subscriptionTier: users.subscriptionTier,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return res.json({
        success: true,
        data: {
          subscriptionTier: 'free',
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
      });
    }

    // If user has an active subscription, fetch live details from Stripe
    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd = false;

    if (user.stripeSubscriptionId) {
      try {
        const sub = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId);
        // In Stripe v20+, current_period_end is on subscription items, not the subscription itself
        const item = sub.items?.data?.[0];
        if (item?.current_period_end) {
          currentPeriodEnd = new Date(item.current_period_end * 1000).toISOString();
        }
        cancelAtPeriodEnd = sub.cancel_at_period_end ?? false;
      } catch (stripeErr) {
        console.warn('Failed to fetch Stripe subscription details:', stripeErr);
      }
    }

    return res.json({
      success: true,
      data: {
        subscriptionTier: user.subscriptionTier,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      },
    });
  } catch (err) {
    console.error('Billing status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch billing status' });
  }
});
