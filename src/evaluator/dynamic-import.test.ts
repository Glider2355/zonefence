import { describe, expect, it } from "vitest";
import type { UnanalyzableImport } from "../core/types.js";
import type { ResolvedRule } from "../rules/types.js";
import { evaluateUnanalyzableImports } from "./dynamic-import.js";
import { evaluate } from "./index.js";

const rootDir = "/project/src";

const call: UnanalyzableImport = {
	sourceFile: `${rootDir}/core/loader.ts`,
	expression: "import(`./${name}.js`)",
	line: 4,
	column: 8,
};

function createRule(
	config: Partial<ResolvedRule["config"]>,
	exclude: string[] = [],
): ResolvedRule[] {
	return [
		{
			directory: `${rootDir}/core`,
			ruleFilePath: `${rootDir}/core/zonefence.yaml`,
			excludePatterns: exclude,
			config: { version: 1, description: "Core layer", ...config },
		},
	];
}

// See https://github.com/Glider2355/zonefence/issues/14
describe("evaluateUnanalyzableImports", () => {
	const fenced = createRule({ imports: { deny: [{ from: "hono" }] } });

	it("should report a non-literal dynamic import inside a fenced directory", () => {
		expect(evaluateUnanalyzableImports([call], fenced, rootDir, "warning")).toEqual([
			{
				sourceFile: `${rootDir}/core/loader.ts`,
				line: 4,
				column: 8,
				rule: "dynamic-import",
				severity: "warning",
				message: "Cannot check import(`./${name}.js`): the specifier is not a string literal",
				ruleFilePath: `${rootDir}/core/zonefence.yaml`,
				designIntent: "Core layer",
			},
		]);
	});

	it("should not report files that no import rule applies to", () => {
		const outside = { ...call, sourceFile: `${rootDir}/scripts/build.ts` };
		const withoutImportRules = createRule({ files: { allow: ["*.ts"] } });

		expect(evaluateUnanalyzableImports([outside], fenced, rootDir, "warning")).toEqual([]);
		expect(evaluateUnanalyzableImports([call], withoutImportRules, rootDir, "warning")).toEqual([]);
	});

	it("should honor scope.exclude", () => {
		const excluding = createRule({ imports: { deny: [{ from: "hono" }] } }, ["**/loader.ts"]);

		expect(evaluateUnanalyzableImports([call], excluding, rootDir, "warning")).toEqual([]);
	});

	it("should collapse a multi-line call into a single short line", () => {
		const long = { ...call, expression: `import(\n\t\`./${"x".repeat(200)}\`\n)` };
		const [violation] = evaluateUnanalyzableImports([long], fenced, rootDir, "warning");

		expect(violation.message).not.toContain("\n");
		expect(violation.message.length).toBeLessThan(140);
	});
});

describe("evaluate - warnings and strict mode", () => {
	const fenced = createRule({ imports: { deny: [{ from: "hono" }] } });

	it("should report non-literal dynamic imports as warnings by default", () => {
		const result = evaluate([], fenced, rootDir, { unanalyzableImports: [call] });

		expect(result.violations.map((violation) => violation.severity)).toEqual(["warning"]);
		expect(result.filesChecked).toBe(1);
	});

	it("should report them as errors in strict mode", () => {
		const result = evaluate([], fenced, rootDir, { unanalyzableImports: [call], strict: true });

		expect(result.violations.map((violation) => violation.severity)).toEqual(["error"]);
	});

	it("should include file placement violations when files are given", () => {
		const rules = createRule({ files: { allow: ["index.ts"] } });
		const result = evaluate([], rules, rootDir, { files: [`${rootDir}/core/extra.ts`] });

		expect(result.violations.map((violation) => violation.rule)).toEqual(["file-placement"]);
	});
});
