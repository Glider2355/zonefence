import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectFiles } from "../core/file-collector.js";
import { loadRulesForDirectoryWithAllDirs } from "../rules/loader.js";
import { resolveRulesWithPatterns } from "../rules/resolver.js";
import type { FilesConfig, ResolvedRule } from "../rules/types.js";
import { evaluateFilePlacement } from "./file-placement.js";

const rootDir = "/project/src";

function createRule(directory: string, files: FilesConfig, exclude: string[] = []): ResolvedRule[] {
	return [
		{
			directory,
			ruleFilePath: `${directory}/zonefence.yaml`,
			excludePatterns: exclude,
			config: { version: 1, description: "Fixture rule", files },
		},
	];
}

// See https://github.com/Glider2355/zonefence/issues/16
describe("evaluateFilePlacement", () => {
	describe("files.allow", () => {
		const routesDir = `${rootDir}/api/routes`;
		const rules = createRule(routesDir, { allow: ["route.ts", "*Dto.ts", "*.test.ts"] });

		it("should accept files matching an allowed pattern", () => {
			const files = [`${routesDir}/route.ts`, `${routesDir}/UserDto.ts`];

			expect(evaluateFilePlacement(files, rules, rootDir)).toEqual([]);
		});

		it("should report a file that matches no allowed pattern", () => {
			const violations = evaluateFilePlacement([`${routesDir}/helpers.ts`], rules, rootDir);

			expect(violations).toEqual([
				{
					sourceFile: `${routesDir}/helpers.ts`,
					line: 1,
					column: 0,
					rule: "file-placement",
					message: 'File "helpers.ts" is not allowed here (allowed: route.ts, *Dto.ts, *.test.ts)',
					ruleFilePath: `${routesDir}/zonefence.yaml`,
					designIntent: "Fixture rule",
				},
			]);
		});

		it("should match a pattern without a slash against the file name in nested directories", () => {
			const files = [`${routesDir}/users/route.ts`, `${routesDir}/users/[id]/route.ts`];

			expect(evaluateFilePlacement(files, rules, rootDir)).toEqual([]);
		});

		it("should match a pattern with a slash against the path from the rule directory", () => {
			const scoped = createRule(routesDir, { allow: ["users/*.ts"] });
			const files = [`${routesDir}/users/route.ts`, `${routesDir}/posts/route.ts`];

			const violations = evaluateFilePlacement(files, scoped, rootDir);

			expect(violations.map((violation) => violation.sourceFile)).toEqual([
				`${routesDir}/posts/route.ts`,
			]);
		});

		it("should not restrict files when allow is empty", () => {
			const unrestricted = createRule(routesDir, { allow: [], require: [] });

			expect(evaluateFilePlacement([`${routesDir}/anything.ts`], unrestricted, rootDir)).toEqual(
				[],
			);
		});

		it("should ignore files outside the rule directory", () => {
			expect(evaluateFilePlacement([`${rootDir}/lib/helpers.ts`], rules, rootDir)).toEqual([]);
		});

		it("should honor scope.exclude", () => {
			const excluding = createRule(routesDir, { allow: ["route.ts"] }, ["**/*.md"]);

			expect(evaluateFilePlacement([`${routesDir}/README.md`], excluding, rootDir)).toEqual([]);
		});
	});

	describe("files.require", () => {
		const uiDir = `${rootDir}/components/ui`;
		const rules = createRule(uiDir, {
			require: [
				{
					for: "**/*.tsx",
					sibling: "{name}.stories.tsx",
					exclude: ["**/*.stories.tsx", "**/*Icon.tsx"],
				},
			],
		});

		it("should accept a file whose sibling exists", () => {
			const files = [`${uiDir}/Button.tsx`, `${uiDir}/Button.stories.tsx`];

			expect(evaluateFilePlacement(files, rules, rootDir)).toEqual([]);
		});

		it("should report a file whose sibling is missing", () => {
			const violations = evaluateFilePlacement([`${uiDir}/Card.tsx`], rules, rootDir);

			expect(violations).toHaveLength(1);
			expect(violations[0].message).toBe('Missing "Card.stories.tsx" next to "Card.tsx"');
		});

		it("should require the sibling in the same directory", () => {
			const files = [`${uiDir}/card/Card.tsx`, `${uiDir}/Card.stories.tsx`];

			expect(evaluateFilePlacement(files, rules, rootDir)).toHaveLength(1);
		});

		it("should skip excluded files", () => {
			expect(evaluateFilePlacement([`${uiDir}/CloseIcon.tsx`], rules, rootDir)).toEqual([]);
		});

		it("should use the rule's message when given", () => {
			const withMessage = createRule(uiDir, {
				require: [{ for: "*.tsx", sibling: "{name}.stories.tsx", message: "Storybook required" }],
			});

			const violations = evaluateFilePlacement([`${uiDir}/Card.tsx`], withMessage, rootDir);

			expect(violations[0].message).toBe("Storybook required");
		});

		it("should expand {stem} and accept a glob for the sibling", () => {
			const colocatedTests = createRule(rootDir, {
				require: [{ for: "**/*.test.ts", sibling: "{stem}.{ts,tsx}" }],
			});
			const files = [
				`${rootDir}/a/user.ts`,
				`${rootDir}/a/user.test.ts`,
				`${rootDir}/b/View.tsx`,
				`${rootDir}/b/View.test.ts`,
				`${rootDir}/c/orphan.test.ts`,
			];

			const violations = evaluateFilePlacement(files, colocatedTests, rootDir);

			expect(violations.map((violation) => violation.sourceFile)).toEqual([
				`${rootDir}/c/orphan.test.ts`,
			]);
			expect(violations[0].message).toBe('Missing "orphan.{ts,tsx}" next to "orphan.test.ts"');
		});

		it("should not let a file satisfy its own requirement", () => {
			const selfMatching = createRule(rootDir, {
				require: [{ for: "*.ts", sibling: "{stem}.*" }],
			});

			expect(evaluateFilePlacement([`${rootDir}/alone.ts`], selfMatching, rootDir)).toHaveLength(1);
		});

		it("should treat glob metacharacters in the file name literally", () => {
			const pageRules = createRule(rootDir, {
				require: [{ for: "**/*.tsx", sibling: "{name}.test.tsx", exclude: ["*.test.tsx"] }],
			});
			const files = [`${rootDir}/app/[id].tsx`, `${rootDir}/app/[id].test.tsx`];

			expect(evaluateFilePlacement(files, pageRules, rootDir)).toEqual([]);
		});
	});

	describe("end to end with a fixture", () => {
		const fixtureDir = path.resolve(__dirname, "../../test-fixtures/file-placement/src");

		it("should apply files rules from zonefence.yaml and directoryPatterns", async () => {
			const { rules, allDirectories } = await loadRulesForDirectoryWithAllDirs(fixtureDir);
			const resolved = resolveRulesWithPatterns(rules, allDirectories);

			const violations = evaluateFilePlacement(collectFiles(fixtureDir), resolved, fixtureDir);

			expect(
				violations.map((violation) => [
					path.relative(fixtureDir, violation.sourceFile),
					violation.message,
				]),
			).toEqual([
				[
					"api/routes/users/helpers.ts",
					'File "helpers.ts" is not allowed here (allowed: route.ts, handler.ts, index.ts, *Dto.ts, *.test.ts)',
				],
				["api/routes/users/orphan.test.ts", 'Missing "orphan.{ts,tsx}" next to "orphan.test.ts"'],
				["components/ui/Card.tsx", "UI components must have a Storybook story"],
			]);
		});

		it("should not list rule files or dotfiles", () => {
			const files = collectFiles(fixtureDir).map((file) => path.basename(file));

			expect(files).not.toContain("zonefence.yaml");
			expect(files).toContain("Button.tsx");
		});
	});
});
