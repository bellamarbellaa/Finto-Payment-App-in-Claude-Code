const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');

const projectRoot = __dirname;
/** The shared API client lives with the backend, outside this project. */
const clientRoot = path.resolve(projectRoot, '../finto-backend/packages/api-client');

const config = getDefaultConfig(projectRoot);

// Metro only watches the project folder by default, so it would not see edits
// to the shared client — or even resolve it.
config.watchFolders = [clientRoot];

config.resolver.extraNodeModules = {
  '@finto/api-client': path.resolve(clientRoot, 'src/index.ts')
};

// Keep resolution anchored to this app's node_modules so the shared client
// cannot drag in a second copy of React.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

const defaultResolve = config.resolver.resolveRequest;

/**
 * The shared client is written for Node's ESM resolution, where a relative
 * import of a TypeScript file must still be spelled `./types.js`. Bundlers that
 * understand TypeScript paths handle that; Metro does not, and looks for a
 * literal `types.js` that never existed.
 *
 * Rewriting the extension here keeps the client valid for every consumer —
 * Node, tsc and Vite included — instead of weakening it to suit one bundler.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const origin = context.originModulePath ?? '';

    if (origin.startsWith(clientRoot)) {
      const candidate = path.resolve(path.dirname(origin), moduleName.replace(/\.js$/, '.ts'));

      if (fs.existsSync(candidate)) {
        return { type: 'sourceFile', filePath: candidate };
      }
    }
  }

  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
