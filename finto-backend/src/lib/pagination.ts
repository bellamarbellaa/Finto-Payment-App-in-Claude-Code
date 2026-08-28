import { z } from 'zod';

/**
 * Cursor pagination, not offset. An activity feed shifts under the user's
 * thumb as new transactions land; offsets would duplicate or skip rows.
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional()
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Cursor {
  occurredAt: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed?.occurredAt === 'string' && typeof parsed?.id === 'string') {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function toPage<T>(rows: T[], limit: number, makeCursor: (row: T) => Cursor): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(makeCursor(last)) : null
  };
}
