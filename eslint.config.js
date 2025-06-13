import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

// see https://www.npmjs.com/package/eslint

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"] },
  { files: ["**/*.{js,mjs,cjs}"], languageOptions: { globals: globals.browser } },
]);
