import path from "node:path";
import type { EvaluationResult } from "../evaluator/types.js";

export interface JsonViolation {
	file: string;
	line: number;
	column: number;
	moduleSpecifier: string;
	message: string;
	rule: string;
	ruleFilePath: string;
	designIntent?: string;
}

export interface JsonReport {
	violations: JsonViolation[];
	summary: {
		errorCount: number;
		filesChecked: number;
		importsChecked: number;
	};
}

/**
 * Build the machine-readable report. Paths are relative to `cwd` so that output
 * is stable across machines.
 */
export function buildJsonReport(result: EvaluationResult, cwd: string = process.cwd()): JsonReport {
	const violations: JsonViolation[] = result.violations.map((violation) => ({
		file: path.relative(cwd, violation.sourceFile),
		line: violation.line,
		column: violation.column,
		moduleSpecifier: violation.moduleSpecifier,
		message: violation.message,
		rule: violation.rule,
		ruleFilePath: path.relative(cwd, violation.ruleFilePath),
		...(violation.designIntent === undefined ? {} : { designIntent: violation.designIntent }),
	}));

	return {
		violations,
		summary: {
			errorCount: violations.length,
			filesChecked: result.filesChecked,
			importsChecked: result.importsChecked,
		},
	};
}

export function reportToJson(result: EvaluationResult, cwd: string = process.cwd()): number {
	console.log(JSON.stringify(buildJsonReport(result, cwd), null, 2));

	return result.violations.length > 0 ? 1 : 0;
}
