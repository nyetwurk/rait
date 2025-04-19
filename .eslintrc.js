module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true, // Important for browser.* APIs
  },
  extends: 'eslint:recommended', // Start with sensible defaults
  parserOptions: {
    ecmaVersion: 'latest', // Use modern JavaScript features
    sourceType: 'module',
  },
  rules: {
    "no-unused-vars": ["error", {
      "args": "after-used", // Check arguments only after the last used argument
      "argsIgnorePattern": "^_" // Ignore arguments starting with _
    }]
  },
  overrides: [
    {
      // Treat the config file itself as Node CommonJS module
      files: ['.eslintrc.js'],
      env: {
        node: true,
      },
      parserOptions: {
         sourceType: 'script', // Use 'script' for CommonJS config files
      },
    },
  ],
};
