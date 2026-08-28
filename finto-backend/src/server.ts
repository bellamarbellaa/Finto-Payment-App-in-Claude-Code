import { buildApp } from './app.js';
import { env } from './env.js';
import { closeDb, pool } from './db/client.js';

const start = async () => {
  const app = await buildApp();

  try {
    // Fail loudly at boot rather than on the first request.
    await pool.query('SELECT 1');
  } catch (err) {
    app.log.error({ err }, 'Could not reach the database. Is DATABASE_URL correct?');
    process.exit(1);
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Finto API listening on http://${env.HOST}:${env.PORT}`);

  /** Finish in-flight requests before exiting — a payment mid-post must not be cut off. */
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down…`);
    try {
      await app.close();
      await closeDb();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
};

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
