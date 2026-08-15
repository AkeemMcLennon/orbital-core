const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [monorepoRoot];

// Extend the resolver configuration for monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Several `@tamagui/*` packages (e.g. `tamagui`, `@tamagui/dialog`,
// `@tamagui/sheet`) ship their own nested `node_modules/@tamagui/portal` copy
// alongside the one hoisted to the workspace root — same version, but a
// SEPARATE module instance with its own React context. TamaguiProvider's
// PortalProvider (resolved via one instance) and @tamagui/toast's portal
// consumer (resolved via the other) then disagree on PortalStateContext,
// crashing with "PortalStateContext cannot be null" the moment a toast tries
// to render. Metro's hierarchical lookup is what finds those nested copies
// before nodeModulesPaths gets a chance; disabling it forces every module to
// resolve through nodeModulesPaths above, so there is exactly one
// `@tamagui/portal` (and one of every other tamagui package) in the bundle.
// Verified: nothing outside `@tamagui/*` relies on a nested per-package
// node_modules in this project.
config.resolver.disableHierarchicalLookup = true;

config.resolver.unstable_enableSymlinks = true;

module.exports = config;
