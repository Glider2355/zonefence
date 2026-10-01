import { describe, expect, it } from "vitest";
import type { EvaluationResult, Violation } from "../evaluator/types.js";
import { formatGithubAnnotation } from "./github.js";
import { buildJsonReport } from "./json.js";
import { exitCodeFor, isMachineReadable, isReporterName } from "./types.js";

const CWD = "/project";

function createViolation(overrides: Partial<Violation> = {}): Violation {
	return {
		sourceFile: "/project/src/core/Novel.ts",
		moduleSpecifier: "hono",
		line: 3,
		column: 0,
		rule: "import-boundary",
		message: "Core layer cannot depend on an HTTP framework",
		ruleFilePath: "/project/src/core/zonefence.yaml",
		designIntent: "Core layer - pure business logic",
		...overrides,
	};
}

function createResult(violations: Violation[]): EvaluationResult {
	return { violations, filesChecked: 4, importsChecked: 12 };
}

// See https://github.com/Glider2355/zonefence/issues/17
describe("buildJsonReport", () => {
	it("should emit one structured entry per violation with paths relative to cwd", () => {
		const report = buildJsonReport(createResult([createViolation()]), CWD);

		expect(report.violations).toEqual([
			{
				file: "src/core/Novel.ts",
				line: 3,
				column: 0,
				severity: "error",
				moduleSpecifier: "hono",
				message: "Core layer cannot depend on an HTTP framework",
				rule: "import-boundary",
				ruleFilePath: "src/core/zonefence.yaml",
				designIntent: "Core layer - pure business logic",
			},
		]);
	});

	it("should omit designIntent when the rule has no description", () => {
		const report = buildJsonReport(
			createResult([createViolation({ designIntent: undefined })]),
			CWD,
		);

		expect(report.violations[0]).not.toHaveProperty("designIntent");
	});

	it("should report a summary", () => {
		const report = buildJsonReport(createResult([createViolation()]), CWD);

		expect(report.summary).toEqual({
			errorCount: 1,
			warningCount: 0,
			filesChecked: 4,
			importsChecked: 12,
		});
	});

	it("should count warnings separately from errors", () => {
		const report = buildJsonReport(
			createResult([createViolation(), createViolation({ severity: "warning" })]),
			CWD,
		);

		expect(report.violations.map((violation) => violation.severity)).toEqual(["error", "warning"]);
		expect(report.summary.errorCount).toBe(1);
		expect(report.summary.warningCount).toBe(1);
	});

	it("should omit moduleSpecifier for violations that are not about an import", () => {
		const report = buildJsonReport(
			createResult([createViolation({ rule: "file-placement", moduleSpecifier: undefined })]),
			CWD,
		);

		expect(report.violations[0]).not.toHaveProperty("moduleSpecifier");
		expect(report.violations[0].rule).toBe("file-placement");
	});

	it("should emit an empty violations array when nothing is wrong", () => {
		const report = buildJsonReport(createResult([]), CWD);

		expect(report.violations).toEqual([]);
		expect(report.summary.errorCount).toBe(0);
	});
});

describe("formatGithubAnnotation", () => {
	it("should emit a workflow error command with file, line and column", () => {
		const annotation = formatGithubAnnotation(createViolation(), CWD);

		expect(annotation).toContain("::error ");
		expect(annotation).toContain("file=src/core/Novel.ts");
		expect(annotation).toContain("line=3");
	});

	it("should report a 1-based column, as annotations expect", () => {
		expect(formatGithubAnnotation(createViolation({ column: 0 }), CWD)).toContain(",col=1,");
		expect(formatGithubAnnotation(createViolation({ column: 16 }), CWD)).toContain(",col=17,");
	});

	it("should emit a workflow warning command for a warning", () => {
		const annotation = formatGithubAnnotation(createViolation({ severity: "warning" }), CWD);

		expect(annotation.startsWith("::warning file=src/core/Novel.ts")).toBe(true);
	});

	it("should include the message, design intent and rule file", () => {
		const annotation = formatGithubAnnotation(createViolation(), CWD);
		const [, message] = annotation.split("::error ")[1].split("::");

		expect(message).toContain("Core layer cannot depend on an HTTP framework");
		expect(message).toContain("Design intent: Core layer - pure business logic");
		expect(message).toContain("Rule: src/core/zonefence.yaml");
	});

	it("should encode newlines in the message rather than breaking the command", () => {
		const annotation = formatGithubAnnotation(createViolation(), CWD);

		expect(annotation.split("\n")).toHaveLength(1);
		expect(annotation).toContain("%0A");
	});

	it("should escape colons and commas in property values", () => {
		const annotation = formatGithubAnnotation(
			createViolation({ sourceFile: "/project/src/a,b/c:d.ts" }),
			CWD,
		);

		expect(annotation).toContain("file=src/a%2Cb/c%3Ad.ts");
	});

	it("should escape percent signs in the message", () => {
		const annotation = formatGithubAnnotation(
			createViolation({ message: "100% forbidden", designIntent: undefined }),
			CWD,
		);

		expect(annotation).toContain("100%25 forbidden");
	});
});

describe("reporter names", () => {
	it("should recognize the supported reporters", () => {
		expect(isReporterName("console")).toBe(true);
		expect(isReporterName("json")).toBe(true);
		expect(isReporterName("github")).toBe(true);
	});

	it("should reject an unknown reporter", () => {
		expect(isReporterName("junit")).toBe(false);
	});

	it("should treat only json and github as machine readable", () => {
		expect(isMachineReadable("json")).toBe(true);
		expect(isMachineReadable("github")).toBe(true);
		expect(isMachineReadable("console")).toBe(false);
	});
});

describe("exitCodeFor", () => {
	it("should fail when there is at least one error", () => {
		expect(exitCodeFor(createResult([createViolation()]))).toBe(1);
		expect(
			exitCodeFor(createResult([createViolation({ severity: "warning" }), createViolation()])),
		).toBe(1);
	});

	it("should pass when there are only warnings", () => {
		expect(exitCodeFor(createResult([createViolation({ severity: "warning" })]))).toBe(0);
	});

	it("should pass when there are no violations", () => {
		expect(exitCodeFor(createResult([]))).toBe(0);
	});
});
