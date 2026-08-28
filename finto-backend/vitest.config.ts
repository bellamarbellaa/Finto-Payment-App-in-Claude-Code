import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Tests run against their own database; loading .env.test here means `npm test`
// works with no wrapper script and can never point at the development data.
config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    environment: 'node',
    // These tests share one database; running files in parallel would let them
    // truncate each other's fixtures mid-assertion.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
