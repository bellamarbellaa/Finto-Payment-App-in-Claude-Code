import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { and, eq, or, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { contacts, users } from '../../db/schema.js';
import { requireUser } from '../../plugins/auth.js';
import { ApiError } from '../../lib/errors.js';
import { initialsOf } from '../users/serializer.js';
import type { Contact } from '../../db/schema.js';

function toPublicContact(contact: Contact) {
  return {
    id: contact.id,
    name: contact.name,
    handle: contact.handle,
    firstName: contact.name.split(/\s+/)[0] ?? contact.name,
    initials: initialsOf(contact.name),
    tint: contact.tint,
    isFavourite: contact.isFavourite,
    /** True when the transfer settles instantly instead of going out on a rail. */
    isFintoUser: Boolean(contact.contactUserId),
    lastPaidAt: contact.lastPaidAt
  };
}

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', (req) => app.requireAuth(req));

  /** The "Choose who to pay" list, with its search field. */
  app.get('/', async (req) => {
    const { userId } = requireUser(req);
    const query = z.object({ q: z.string().max(120).optional() }).parse(req.query);

    const filters = [eq(contacts.userId, userId)];

    if (query.q) {
      const pattern = `%${query.q.trim().toLowerCase()}%`;
      filters.push(
        or(
          sql`lower(${contacts.name}) LIKE ${pattern}`,
          sql`lower(${contacts.handle}) LIKE ${pattern}`
        )!
      );
    }

    const rows = await db
      .select()
      .from(contacts)
      .where(and(...filters))
      /*
       * Recently paid first — that is what people actually reach for.
       * NULLS LAST matters: Postgres sorts NULLs first under DESC, which would
       * push every never-paid contact above the one you paid an hour ago.
       */
      .orderBy(
        desc(contacts.isFavourite),
        sql`${contacts.lastPaidAt} DESC NULLS LAST`,
        contacts.name
      )
      .limit(100);

    return { contacts: rows.map(toPublicContact) };
  });

  app.post('/', async (req, reply) => {
    const { userId } = requireUser(req);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        handle: z.string().min(2).max(80),
        tint: z.enum(['lime', 'forest', 'sand', 'sky', 'stone']).default('stone')
      })
      .parse(req.body);

    // Link the contact to a Finto account when the handle matches one.
    const match = await db.query.users.findFirst({
      where: sql`lower(${users.handle}) = ${body.handle.toLowerCase()} OR lower(${users.email}) = ${body.handle.toLowerCase()}`,
      columns: { id: true }
    });

    const [created] = await db
      .insert(contacts)
      .values({
        userId,
        name: body.name,
        handle: body.handle,
        tint: body.tint,
        contactUserId: match?.id && match.id !== userId ? match.id : null
      })
      .onConflictDoNothing()
      .returning();

    if (!created) throw ApiError.conflict('That contact already exists.');

    reply.code(201);
    return { contact: toPublicContact(created) };
  });

  app.patch('/:id', async (req) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        isFavourite: z.boolean().optional(),
        tint: z.enum(['lime', 'forest', 'sand', 'sky', 'stone']).optional()
      })
      .parse(req.body);

    const [updated] = await db
      .update(contacts)
      .set(body)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();

    if (!updated) throw ApiError.notFound('Contact');
    return { contact: toPublicContact(updated) };
  });

  app.delete('/:id', async (req, reply) => {
    const { userId } = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);

    const [deleted] = await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning({ id: contacts.id });

    if (!deleted) throw ApiError.notFound('Contact');
    reply.code(204);
  });

  /** Look up a Finto user by handle before saving them as a contact. */
  app.get('/lookup', async (req) => {
    const { userId } = requireUser(req);
    const query = z.object({ handle: z.string().min(2).max(80) }).parse(req.query);
    const handle = query.handle.trim().toLowerCase();

    const match = await db.query.users.findFirst({
      where: sql`lower(${users.handle}) = ${handle} OR lower(${users.email}) = ${handle}`,
      columns: { id: true, fullName: true, handle: true, tint: true }
    });

    if (!match || match.id === userId) return { found: false, user: null };

    // Deliberately no email or phone in the response — a handle lookup must not
    // become a way to harvest contact details.
    return {
      found: true,
      user: {
        fullName: match.fullName,
        handle: match.handle,
        tint: match.tint,
        initials: initialsOf(match.fullName)
      }
    };
  });
};

export default routes;
