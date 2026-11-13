import base from "@c1imob/config/eslint";

export default [
  { ignores: ["eslint.config.js", ".next/**", "next-env.d.ts", "components.json"] },
  ...base,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
