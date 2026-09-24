import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Globals Max provides to `js` / `v8` scripts
const maxGlobals = {
  autowatch: "writable",
  inlets: "writable",
  outlets: "writable",
  outlet: "readonly",
  post: "readonly",
  messnamed: "readonly",
  arrayfromargs: "readonly",
  jsarguments: "readonly",
  LiveAPI: "readonly",
  Task: "readonly",
  Dict: "readonly",
  require: "readonly",
};

export default defineConfig([
  { ignores: ["**/node_modules/", "max/pf4-engine.js", "prototypes/"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      // `_name` marks a deliberately unused parameter
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{js,jsx,cjs,mjs}"],
    rules: {
      "no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      "no-constant-condition": "warn",
    },
  },
  {
    // Max device scripts: top-level functions are message handlers Max calls by name
    files: ["max/**/*.js"],
    languageOptions: { sourceType: "script", globals: maxGlobals },
    rules: { "no-unused-vars": ["error", { vars: "local" }] },
  },
  {
    files: ["*.{js,mjs,cjs}", "engine/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
]);
