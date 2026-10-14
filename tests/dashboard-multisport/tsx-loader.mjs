import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { resolve as resolveLocal } from "../../scripts/local-ts-loader.mjs";
export async function resolve(specifier, context, next) {
  if (specifier === "next/link") return next("next/link.js", context);
  return resolveLocal(specifier, context, next);
}
export async function load(url, context, next) {
  if (
    url.startsWith("file:") &&
    /\.tsx?$/.test(url) &&
    !url.includes("/node_modules/")
  ) {
    const source = await fs.readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  }
  return next(url, context);
}
