import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: ["browser-polyfill.js"],
  },
  {
    languageOptions: {
      globals: { ...globals.browser, browser: "readonly", chrome: "readonly" },
    },
    rules: {
      "no-unused-vars": ["error", { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
];
