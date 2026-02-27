import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export const webhooksRouter = Router();

/**
 * Clerk webhook handler — syncs user creation/updates/deletions to our DB.
 */
webhooksRouter.post('/clerk', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    if (!type || !data) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload' });
    }

    console.log(`Clerk webhook received: ${type}`);

    switch (type) {
      case 'user.created': {
        const { id: clerkId, email_addresses, first_name, last_name } = data;
        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(' ') || null;

        console.log(`New user registered: ${email} (${clerkId})`);

        await db.insert(users).values({
          clerkId,
          email: email || '',
          name,
          subscriptionTier: 'free',
          perDiemSource: 'gsa',
        }).onConflictDoNothing();

        return res.json({ success: true, message: 'User created' });
      }

      case 'user.updated': {
        const { id: clerkId, email_addresses, first_name, last_name } = data;
        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(' ') || null;

        console.log(`User updated: ${email} (${clerkId})`);

        await db
          .update(users)
          .set({ email: email || undefined, name, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkId));

        return res.json({ success: true, message: 'User updated' });
      }

      case 'user.deleted': {
        const { id: clerkId } = data;
        console.log(`User deleted: ${clerkId}`);

        await db.delete(users).where(eq(users.clerkId, clerkId));

        return res.json({ success: true, message: 'User deleted' });
      }

      default:
        console.log(`Unhandled webhook type: ${type}`);
        return res.json({ success: true, message: 'Webhook received' });
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});
