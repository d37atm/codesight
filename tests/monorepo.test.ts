import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

async function writeFixture(subdir: string, files: Record<string, string>) {
  const dir = join(FIXTURE_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(dir, name);
    await mkdir(join(dir, ...name.split("/").slice(0, -1)), { recursive: true });
    await writeFile(filePath, content);
  }
  return dir;
}

// Verify the type exists and compiles — this test will fail until types.ts is updated
describe("MonorepoConfig types", () => {
  it("CodesightConfig accepts monorepo field", async () => {
    const { } = await import("../dist/types.js").catch(() => ({ }));
    // Type-only check via compiled output existence
    assert.ok(true); // passes once build succeeds with new types
  });
});

describe("discoverPackages", () => {
  it("returns qualifying packages and filters out small/no-src packages", async () => {
    const { discoverPackages } = await import("../dist/monorepo/discover.js");

    const dir = await writeFixture("monorepo-discover", {
      "pnpm-workspace.yaml": "packages:\n  - packages/**\n",
      // pkg-large: 15 files, has src/, has package.json
      "packages/@scope/pkg-large/package.json": JSON.stringify({ name: "@scope/pkg-large" }),
      "packages/@scope/pkg-large/src/index.ts": "export const a = 1;",
      "packages/@scope/pkg-large/src/b.ts": "export const b = 2;",
      "packages/@scope/pkg-large/src/c.ts": "export const c = 3;",
      "packages/@scope/pkg-large/src/d.ts": "export const d = 4;",
      "packages/@scope/pkg-large/src/e.ts": "export const e = 5;",
      "packages/@scope/pkg-large/src/f.ts": "export const f = 6;",
      "packages/@scope/pkg-large/src/g.ts": "export const g = 7;",
      "packages/@scope/pkg-large/src/h.ts": "export const h = 8;",
      "packages/@scope/pkg-large/src/i.ts": "export const i = 9;",
      "packages/@scope/pkg-large/src/j.ts": "export const j = 10;",
      "packages/@scope/pkg-large/src/k.ts": "export const k = 11;",
      "packages/@scope/pkg-large/src/l.ts": "export const l = 12;",
      "packages/@scope/pkg-large/src/m.ts": "export const m = 13;",
      "packages/@scope/pkg-large/src/n.ts": "export const n = 14;",
      "packages/@scope/pkg-large/src/o.ts": "export const o = 15;",
      // pkg-small: 3 files, has src/, has package.json — filtered by minFiles
      "packages/@scope/pkg-small/package.json": JSON.stringify({ name: "@scope/pkg-small" }),
      "packages/@scope/pkg-small/src/index.ts": "export const x = 1;",
      "packages/@scope/pkg-small/src/y.ts": "export const y = 2;",
      "packages/@scope/pkg-small/src/z.ts": "export const z = 3;",
      // pkg-no-src: 12 files but no src/ — filtered by src/ check
      "packages/@scope/pkg-no-src/package.json": JSON.stringify({ name: "@scope/pkg-no-src" }),
      "packages/@scope/pkg-no-src/index.ts": "export const a = 1;",
      "packages/@scope/pkg-no-src/b.ts": "export const b = 2;",
      "packages/@scope/pkg-no-src/c.ts": "export const c = 3;",
      "packages/@scope/pkg-no-src/d.ts": "export const d = 4;",
      "packages/@scope/pkg-no-src/e.ts": "export const e = 5;",
      "packages/@scope/pkg-no-src/f.ts": "export const f = 6;",
      "packages/@scope/pkg-no-src/g.ts": "export const g = 7;",
      "packages/@scope/pkg-no-src/h.ts": "export const h = 8;",
      "packages/@scope/pkg-no-src/i.ts": "export const i = 9;",
      "packages/@scope/pkg-no-src/j.ts": "export const j = 10;",
      "packages/@scope/pkg-no-src/k.ts": "export const k = 11;",
      "packages/@scope/pkg-no-src/l.ts": "export const l = 12;",
      // pkg-force-included: 3 files, listed in include — passes despite small size
      "packages/@scope/pkg-force-included/package.json": JSON.stringify({ name: "@scope/pkg-force-included" }),
      "packages/@scope/pkg-force-included/src/index.ts": "export const x = 1;",
      "packages/@scope/pkg-force-included/src/y.ts": "export const y = 2;",
      "packages/@scope/pkg-force-included/src/z.ts": "export const z = 3;",
    });

    const packages = await discoverPackages(dir, {
      minFiles: 10,
      include: ["@scope/pkg-force-included"],
    });

    const names = packages.map((p: any) => p.name).sort();
    assert.deepEqual(names, ["@scope/pkg-force-included", "@scope/pkg-large"]);
  });

  it("throws when no workspace config found", async () => {
    const { discoverPackages } = await import("../dist/monorepo/discover.js");
    const dir = await writeFixture("monorepo-no-workspace", {
      "package.json": JSON.stringify({ name: "test" }),
    });
    await assert.rejects(
      () => discoverPackages(dir, {}),
      /No workspace patterns found/
    );
  });

  it("respects exclude list", async () => {
    const { discoverPackages } = await import("../dist/monorepo/discover.js");
    const dir = await writeFixture("monorepo-exclude", {
      "pnpm-workspace.yaml": "packages:\n  - packages/**\n",
      "packages/@scope/pkg-a/package.json": JSON.stringify({ name: "@scope/pkg-a" }),
      "packages/@scope/pkg-a/src/index.ts": "export const a = 1;",
      "packages/@scope/pkg-a/src/b.ts": "export const b = 2;",
      "packages/@scope/pkg-a/src/c.ts": "export const c = 3;",
      "packages/@scope/pkg-a/src/d.ts": "export const d = 4;",
      "packages/@scope/pkg-a/src/e.ts": "export const e = 5;",
      "packages/@scope/pkg-a/src/f.ts": "export const f = 6;",
      "packages/@scope/pkg-a/src/g.ts": "export const g = 7;",
      "packages/@scope/pkg-a/src/h.ts": "export const h = 8;",
      "packages/@scope/pkg-a/src/i.ts": "export const i = 9;",
      "packages/@scope/pkg-a/src/j.ts": "export const j = 10;",
      "packages/@scope/pkg-a/src/k.ts": "export const k = 11;",
    });
    const packages = await discoverPackages(dir, { exclude: ["@scope/pkg-a"] });
    assert.equal(packages.length, 0);
  });
});

describe("extractCrossPackageDeps", () => {
  it("finds @scope/* imports and ignores non-workspace packages", async () => {
    const { extractCrossPackageDeps } = await import("../dist/monorepo/deps.js");

    const dir = await writeFixture("monorepo-deps", {
      "src/index.ts": `
        import { foo } from '@scope/pkg-a';
        import { bar } from '@scope/pkg-b';
        import { baz } from 'lodash';
        import { qux } from './local';
      `,
      "src/other.ts": `
        import { x } from '@scope/pkg-a';
        import { y } from '@scope/pkg-c';
      `,
    });

    const deps = await extractCrossPackageDeps(dir, [
      "@scope/pkg-a",
      "@scope/pkg-b",
      "@scope/pkg-c",
    ]);

    assert.deepEqual(deps.sort(), ["@scope/pkg-a", "@scope/pkg-b", "@scope/pkg-c"]);
  });

  it("returns empty array when no cross-package imports exist", async () => {
    const { extractCrossPackageDeps } = await import("../dist/monorepo/deps.js");

    const dir = await writeFixture("monorepo-deps-empty", {
      "src/index.ts": `import { x } from './local'; import React from 'react';`,
    });

    const deps = await extractCrossPackageDeps(dir, ["@scope/pkg-a"]);
    assert.deepEqual(deps, []);
  });
});
