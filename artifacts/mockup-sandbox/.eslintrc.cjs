module.exports = {
  root: true,
  extends: [
    "../../.eslintrc.base.cjs",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  plugins: ["react", "react-hooks"],
  settings: { react: { version: "detect" } },
  env: { browser: true, es2022: true },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react/no-unknown-property": [
      "error",
      { ignore: ["cmdk-input-wrapper"] },
    ],
  },
  ignorePatterns: ["node_modules/", "dist/", "src/.generated/"],
};
