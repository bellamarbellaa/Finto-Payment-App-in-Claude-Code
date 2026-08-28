import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { supportMessages, supportTickets } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';

/** The Help screen's static list. Kept server-side so copy ships without a release. */
const FAQ = [
  { id: 'freeze', question: 'How do I freeze my card?', answer: 'Open Cards, then tap Freeze. It takes effect immediately and you can unfreeze at any time.', category: 'Cards' },
  { id: 'limits', question: 'Can I set a spending limit?', answer: 'Yes — Cards → Card controls → Monthly limit. We block anything above it.', category: 'Cards' },
  { id: 'currencies', question: 'Which currencies can I hold?', answer: 'Fourteen, including USD, EUR and GBP. Open a balance from the Accounts screen.', category: 'Accounts' },
  { id: 'failed', question: 'Why did my payment fail?', answer: 'Usually available balance or a card control. Open the transaction to see the exact reason.', category: 'Payments' },
  { id: 'pending', question: 'How long do payments take?', answer: 'Finto to Finto is instant. Outbound transfers settle the same working day.', category: 'Payments' }
];

const routes: FastifyPluginAsync = async (app) => {
  app.get('/faq', async (req) => {
    const query = z.object({ q: z.string().max(120).optional() }).parse(req.query);
    if (!query.q) return { faq: FAQ };

    const needle = query.q.toLowerCase();
    return {
      faq: FAQ.filter(
        (item) =>
          item.question.toLowerCase().includes(needle) || item.answer.toLowerCase().includes(needle)
      )
    };
  });

  app.register(async (secured) => {
    secured.addHook('preHandler', (req) => app.requireAuth(req));

    secured.get('/tickets', async (req) => {
      const { userId } = requireUser(req);
      const rows = await db.query.supportTickets.findMany({
        where: eq(supportTickets.userId, userId),
        orderBy: [desc(supportTickets.createdAt)],
        limit: 50
      });
      return { tickets: rows };
    });

    secured.post('/tickets', async (req, reply) => {
      const { userId } = requireUser(req);
      const body = z
        .object({
          subject: z.string().min(3).max(140),
          message: z.string().min(1).max(4000),
          transactionId: z.string().uuid().optional()
        })
        .parse(req.body);

      const ticket = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(supportTickets)
          .values({
            userId,
            subject: body.subject,
            relatedTransactionId: body.transactionId ?? null
          })
          .returning();

        await tx.insert(supportMessages).values({
          ticketId: created!.id,
          author: 'user',
          body: body.message
        });

        return created!;
      });

      reply.code(201);
      return { ticket };
    });

    secured.get('/tickets/:id', async (req) => {
      const { userId } = requireUser(req);
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

      const ticket = await db.query.supportTickets.findFirst({
        where: and(eq(supportTickets.id, id), eq(supportTickets.userId, userId))
      });
      if (!ticket) throw ApiError.notFound('Ticket');

      const messages = await db.query.supportMessages.findMany({
        where: eq(supportMessages.ticketId, id),
        orderBy: [asc(supportMessages.createdAt)]
      });

      return { ticket, messages };
    });

    secured.post('/tickets/:id/messages', async (req, reply) => {
      const { userId } = requireUser(req);
      const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
      const body = z.object({ message: z.string().min(1).max(4000) }).parse(req.body);

      const ticket = await db.query.supportTickets.findFirst({
        where: and(eq(supportTickets.id, id), eq(supportTickets.userId, userId))
      });
      if (!ticket) throw ApiError.notFound('Ticket');
      if (ticket.status === 'resolved') throw ApiError.conflict('This ticket is closed.');

      const [created] = await db
        .insert(supportMessages)
        .values({ ticketId: id, author: 'user', body: body.message })
        .returning();

      await db
        .update(supportTickets)
        .set({ status: 'open', updatedAt: new Date() })
        .where(eq(supportTickets.id, id));

      reply.code(201);
      return { message: created };
    });
  });
};

export default routes;
