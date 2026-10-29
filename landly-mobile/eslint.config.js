// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // tests/ runs under the repo root's vitest and imports it from there.
    ignores: ["dist/*", "tests/*"],
  }
]);
