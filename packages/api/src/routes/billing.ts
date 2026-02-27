import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
});

export const billingRouter = Router();

/**
 * POST /api/billing/create-checkout — Create a Stripe Checkout session
 *
 * Body: { plan: 'pro' | 'proplus' }
 */
billingRouter.post('/create-checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    const clerkId = req.auth!.userId;
    const email = req.auth!.email;

    if (!plan || !['pro', 'proplus'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Must be "pro" or "proplus".',
      });
    }

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
      const prices = await stripe.prices.list({
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
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: amount,
          currency: 'usd',
          recurring: { interval: 'month' },
        });
        priceId = price.id;
        console.log(`Created new price for ${plan}: ${priceId} ($${amount / 100}/mo)`);
      }
    }

    const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: clerkId,
      metadata: {
        clerkId,
        plan,
      },
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/dashboard/billing?cancelled=true`,
    });

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

    // TODO: Look up stripeCustomerId from DB
    // const user = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    // const customerId = user[0]?.stripeCustomerId;

    // For MVP, search by metadata
    const customers = await stripe.customers.list({
      limit: 1,
      // email lookup as fallback
    });

    // If no customer found, redirect to checkout instead
    if (customers.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found. Please subscribe first.',
        redirectUrl: '/dashboard/billing',
      });
    }

    const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
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
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
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

      // TODO: Update user's subscription in DB
      // await db.update(users)
      //   .set({
      //     subscriptionTier: plan as SubscriptionTier,
      //     stripeCustomerId: session.customer as string,
      //     stripeSubscriptionId: session.subscription as string,
      //     updatedAt: new Date(),
      //   })
      //   .where(eq(users.clerkId, clerkId!));

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status;

      console.log(`Subscription updated: ${subscription.id} → status: ${status}`);

      // TODO: Update subscription status in DB
      // Handle downgrade, upgrade, past_due, etc.
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      console.log(`Subscription cancelled: ${subscription.id}`);

      // TODO: Downgrade user to free tier in DB
      // await db.update(users)
      //   .set({ subscriptionTier: 'free', stripeSubscriptionId: null, updatedAt: new Date() })
      //   .where(eq(users.stripeSubscriptionId, subscription.id));

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`Payment failed for invoice: ${invoice.id}`);

      // TODO: Send email notification about failed payment
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
    // TODO: Look up from DB
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
  } catch (err) {
    console.error('Billing status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch billing status' });
  }
});
