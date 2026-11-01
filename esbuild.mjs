import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

const externalPackages = [
  "vscode",
  "mistral-tokenizer-ts",
  "@cyberlangke/tokkit-deepseek",
  "@cyberlangke/tokkit-core",
];

const extensionOptions = {
  absWorkingDir: root,
  entryPoints: {
    extension: "src/extension.ts",
    "providers/openai": "src/tokenization/providers/openai.ts",
    "providers/anthropic": "src/tokenization/providers/anthropic.ts",
    "providers/gemini": "src/tokenization/providers/gemini.ts",
    "providers/llama": "src/tokenization/providers/llama.ts",
    "providers/mistral": "src/tokenization/providers/mistral.ts",
    "providers/deepseek": "src/tokenization/providers/deepseek.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  external: externalPackages,
  logLevel: "info",
};

const webviewOptions = {
  absWorkingDir: root,
  entryPoints: { webview: "src/webview-ui/index.tsx" },
  outdir: "dist",
  bundle: true,
  format: "iife",
  globalName: "promptCostWebview",
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
};

const cssOptions = {
  absWorkingDir: root,
  entryPoints: ["src/webview-ui/styles.css"],
  outfile: "dist/webview.css",
  bundle: true,
  logLevel: "info",
};

function vendorRuntimePackages() {
  const destination = join(root, "dist", "node_modules");
  rmSync(destination, { recursive: true, force: true });
  const packages = [
    "mistral-tokenizer-ts",
    "js-tiktoken",
    "base64-js",
    "@cyberlangke/tokkit-deepseek",
    "@cyberlangke/tokkit-core",
  ];
  for (const name of packages) {
    const from = join(root, "node_modules", name);
    const to = join(destination, name);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, dereference: true });
  }
}

async function main() {
  if (watch) {
    const extension = await esbuild.context(extensionOptions);
    const webview = await esbuild.context(webviewOptions);
    const css = await esbuild.context(cssOptions);
    await Promise.all([extension.watch(), webview.watch(), css.watch()]);
    vendorRuntimePackages();
    return;
  }

  await Promise.all([
    esbuild.build(extensionOptions),
    esbuild.build(webviewOptions),
    esbuild.build(cssOptions),
  ]);
  vendorRuntimePackages();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
