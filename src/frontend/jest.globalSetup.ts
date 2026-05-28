// Cheap guard against silent test-coverage loss.
// Counts `it(` / `test(` occurrences across src/ and fails the run if the
// total drops below MINIMUM_TESTS. When a removal is legitimate, lower the
// floor in the same PR and explain why.
//
// Skipped automatically for filtered runs (`pnpm test -- -t "foo"`).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const MINIMUM_TESTS = 690; // 2026-05-28 floor (after Plan 01 contract-fixes); count ~695. Drop is from removing the dead useAlerts mock-hook test (~6) and consolidating the wizard tests from 3-step to 2-step (~3).
const SRC_ROOT = resolve(__dirname, "src");
const IGNORE_DIRS = new Set(["node_modules", ".next", "coverage", "e2e"]);
const TEST_FILE_RE = /\.test\.(ts|tsx)$/;
const TEST_CASE_RE = /\b(it|test)(?:\.each\([^)]*\))?\s*\(/g;

function* walkTestFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      yield* walkTestFiles(fullPath);
    } else if (TEST_FILE_RE.test(entry)) {
      yield fullPath;
    }
  }
}

export default async function globalSetup(): Promise<void> {
  const argv = process.argv.join(" ");
  if (/--testPathPattern|--testNamePattern|\s-t\s/.test(argv)) return;

  let approxTestCount = 0;
  for (const file of walkTestFiles(SRC_ROOT)) {
    const content = readFileSync(file, "utf8");
    approxTestCount += (content.match(TEST_CASE_RE) ?? []).length;
  }

  if (approxTestCount < MINIMUM_TESTS) {
    throw new Error(
      `Test floor violated: counted ~${approxTestCount} cases, expected >= ${MINIMUM_TESTS}. ` +
        `If the drop is legitimate, lower MINIMUM_TESTS in jest.globalSetup.ts ` +
        `and explain why in the PR description.`,
    );
  }
}
