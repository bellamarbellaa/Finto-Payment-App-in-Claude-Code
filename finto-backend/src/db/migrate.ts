import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, closeDb } from './client.js';

const run = async () => {
  console.log('Running migrations…');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');
  await closeDb();
};

run().catch(async (err) => {
  console.error('Migration failed:', err);
  await closeDb();
  process.exit(1);
});
