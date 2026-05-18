module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
    "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
  },
  ignorePatterns: ["node_modules/", "dist/", "build/", ".next/"],
  overrides: [
    {
      files: ["*.cjs"],
      env: { node: true },
      parserOptions: { sourceType: "script" },
    },
  ],
};
