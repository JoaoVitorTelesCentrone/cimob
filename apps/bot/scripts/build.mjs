// Empacota o bot num único dist/server.js para a imagem Docker.
// O Node não remove tipos de .ts dentro de node_modules, e é lá que os pacotes do workspace
// (@c1imob/core, @c1imob/ai) ficariam na imagem; empacotados, viram JS comum.
// Dependências diretas de terceiros ficam de fora (BullMQ e afins leem arquivos do próprio pacote).
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const external = Object.keys(pkg.dependencies ?? {}).filter((name) => !name.startsWith("@c1imob/"));

await build({
  entryPoints: [new URL("../src/server.ts", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")],
  outfile: new URL("../dist/server.js", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external,
  // Dependências CommonJS empacotadas usam require(); no ESM ele precisa existir.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "warning",
});
console.log(`dist/server.js pronto (externas: ${external.join(", ")})`);
