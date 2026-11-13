import base from "@c1imob/config/eslint";

export default [
  { ignores: ["eslint.config.js"] },
  ...base,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
