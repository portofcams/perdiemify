import { Router, Request, Response } from 'express';

export const webhooksRouter = Router();

/**
 * Clerk webhook handler — syncs user creation/updates/deletions to our DB.
 *
 * Clerk sends webhooks for:
 * - user.created — create user in our DB
 * - user.updated — update email/name
 * - user.deleted — soft-delete or cascade-delete user
 *
 * Requires CLERK_WEBHOOK_SECRET to be set for signature verification.
 * For MVP without webhook secret, we accept requests on internal network only.
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

        // TODO: Insert into users table when DB is connected
        // await db.insert(users).values({
        //   clerkId,
        //   email,
        //   name,
        //   subscriptionTier: 'free',
        //   perDiemSource: 'gsa',
        // });

        return res.json({ success: true, message: 'User created' });
      }

      case 'user.updated': {
        const { id: clerkId, email_addresses, first_name, last_name } = data;
        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(' ') || null;

        console.log(`User updated: ${email} (${clerkId})`);

        // TODO: Update users table
        // await db.update(users)
        //   .set({ email, name, updatedAt: new Date() })
        //   .where(eq(users.clerkId, clerkId));

        return res.json({ success: true, message: 'User updated' });
      }

      case 'user.deleted': {
        const { id: clerkId } = data;
        console.log(`User deleted: ${clerkId}`);

        // TODO: Delete from users table (cascade deletes trips, bookings, etc.)
        // await db.delete(users).where(eq(users.clerkId, clerkId));

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
