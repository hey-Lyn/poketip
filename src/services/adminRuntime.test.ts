import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("loads the emitted admin endpoint in Node ESM and returns a JSON auth error", () => {
  // Vitest resolves extensionless TS imports; production Node ESM does not.
  const cacheRoot = resolve("node_modules/.cache");
  mkdirSync(cacheRoot, { recursive: true });
  const output = mkdtempSync(join(cacheRoot, "admin-runtime-"));
  if (dirname(output) !== cacheRoot) throw new Error("Unexpected runtime test cleanup path.");
  try {
    writeFileSync(join(output, "package.json"), '{"type":"module"}');
    for (const file of ["api/admin/users.ts", "api/_lib/admin.ts", "api/_lib/auth.ts", "api/_lib/validateAiRequest.ts"]) {
      const destination = join(output, file.replace(/\.ts$/u, ".js"));
      mkdirSync(dirname(destination), { recursive: true });
      const emitted = ts.transpileModule(readFileSync(resolve(file), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      writeFileSync(destination, emitted.outputText);
    }
    const endpoint = pathToFileURL(join(output, "api/admin/users.js")).href;
    const script = `
      const { default: handler } = await import(${JSON.stringify(endpoint)});
      const response = {
        setHeader() {}, status(code) { this.code = code; return this; },
        json(body) { console.log(JSON.stringify({ status: this.code, body })); }
      };
      await handler({ method: 'GET', headers: {} }, response);
    `;
    const result = execFileSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8", timeout: 10000 });
    expect(JSON.parse(result)).toMatchObject({ status: 401, body: { error: { code: "AUTH_REQUIRED" } } });
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
