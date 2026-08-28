/**
 * bigint is not valid JSON. Rather than letting a stray balance crash a
 * response, every bigint is serialised as a decimal string. Clients that need
 * arithmetic parse it back into BigInt; clients that only display it use the
 * pre-formatted `formatted` field.
 */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val))
  );
}

/** Fastify serialiser replacement, registered once in app.ts. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
