import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { expensifyConnectSchema, integrationPushSchema } from '@perdiemify/shared';
import { db } from '../db';
import { users, integrations } from '../db/schema';
import { expensePushQueue } from '../queue/queues';

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

async function getUserId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

/** GET /api/integrations — List connected integrations */
integrationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.json({ success: true, data: [] });

    const rows = await db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        isActive: integrations.isActive,
        externalUserId: integrations.externalUserId,
        createdAt: integrations.createdAt,
      })
      .from(integrations)
      .where(eq(integrations.userId, userId))
      .orderBy(desc(integrations.createdAt));

    return res.json({ success: true, data: rows });
  } catch (err: unknown) {
    console.error('List integrations error:', err);
    return res.status(500).json({ success: false, error: 'Failed to list integrations' });
  }
});

/** POST /api/integrations/concur/connect — Initiate Concur OAuth */
integrationsRouter.post('/concur/connect', async (req: Request, res: Response) => {
  try {
    const clientId = process.env.CONCUR_CLIENT_ID;
    const redirectUri = process.env.CONCUR_REDIRECT_URI || 'https://perdiemify.com/api/integrations/concur/callback';

    if (!clientId) {
      return res.status(503).json({ success: false, error: 'Concur integration not configured' });
    }

    const authUrl = `https://us.api.concursolutions.com/oauth2/v0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=EXPRPT`;

    return res.json({ success: true, data: { authUrl } });
  } catch (err: unknown) {
    console.error('Concur connect error:', err);
    return res.status(500).json({ success: false, error: 'Failed to initiate Concur connection' });
  }
});

/** GET /api/integrations/concur/callback — Concur OAuth callback */
integrationsRouter.get('/concur/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, error: 'Missing authorization code' });

    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const clientId = process.env.CONCUR_CLIENT_ID;
    const clientSecret = process.env.CONCUR_CLIENT_SECRET;
    const redirectUri = process.env.CONCUR_REDIRECT_URI || 'https://perdiemify.com/api/integrations/concur/callback';

    if (!clientId || !clientSecret) {
      return res.status(503).json({ success: false, error: 'Concur not configured' });
    }

    // Exchange code for token
    const tokenRes = await fetch('https://us.api.concursolutions.com/oauth2/v0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      return res.status(400).json({ success: false, error: `Token exchange failed: ${body}` });
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      geolocation: string;
    };

    // Upsert integration
    await db
      .insert(integrations)
      .values({
        userId,
        provider: 'concur',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrations.userId, integrations.provider],
        set: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          isActive: true,
        },
      });

    return res.redirect('https://perdiemify.com/dashboard/integrations?connected=concur');
  } catch (err: unknown) {
    console.error('Concur callback error:', err);
    return res.status(500).json({ success: false, error: 'Failed to complete Concur connection' });
  }
});

/** POST /api/integrations/expensify/connect — Save Expensify API credentials */
integrationsRouter.post('/expensify/connect', validateBody(expensifyConnectSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const { partnerUserID, partnerUserSecret, employeeEmail } = req.body;

    // Store credentials as "userID:secret"
    await db
      .insert(integrations)
      .values({
        userId,
        provider: 'expensify',
        accessToken: `${partnerUserID}:${partnerUserSecret}`,
        externalUserId: employeeEmail || null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrations.userId, integrations.provider],
        set: {
          accessToken: `${partnerUserID}:${partnerUserSecret}`,
          externalUserId: employeeEmail || null,
          isActive: true,
        },
      });

    return res.json({ success: true, message: 'Expensify integration connected' });
  } catch (err: unknown) {
    console.error('Expensify connect error:', err);
    return res.status(500).json({ success: false, error: 'Failed to connect Expensify' });
  }
});

/** DELETE /api/integrations/:id — Disconnect an integration */
integrationsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(404).json({ success: false, error: 'Integration not found' });

    const integrationId = req.params.id as string;

    const [existing] = await db
      .select({ userId: integrations.userId })
      .from(integrations)
      .where(sql`${integrations.id} = ${integrationId}`)
      .limit(1);

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    await db.delete(integrations).where(sql`${integrations.id} = ${integrationId}`);
    return res.json({ success: true, message: 'Integration disconnected' });
  } catch (err: unknown) {
    console.error('Delete integration error:', err);
    return res.status(500).json({ success: false, error: 'Failed to disconnect integration' });
  }
});

/** POST /api/integrations/push/:tripId — Queue expense push for a trip */
integrationsRouter.post('/push/:tripId', validateBody(integrationPushSchema), async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req.auth!.userId);
    if (!userId) return res.status(400).json({ success: false, error: 'User not found' });

    const { provider } = req.body;

    // Verify user has active integration
    const [integration] = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.provider, provider),
          eq(integrations.isActive, true),
        )
      )
      .limit(1);

    if (!integration) {
      return res.status(400).json({ success: false, error: `No active ${provider} integration. Connect first.` });
    }

    // Queue the push job
    await expensePushQueue.add(`push-${provider}-${req.params.tripId}`, {
      userId,
      tripId: req.params.tripId,
      provider,
    });

    return res.json({ success: true, message: `Expense push to ${provider} queued` });
  } catch (err: unknown) {
    console.error('Push expense error:', err);
    return res.status(500).json({ success: false, error: 'Failed to queue expense push' });
  }
});
