import base from "@c1imob/config/eslint";

export default [
  { ignores: ["eslint.config.js", "scripts/**", "dist/**"] },
  ...base,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
