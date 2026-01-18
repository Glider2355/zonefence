import type { ImportInfo } from "../core/types.js";
import type { ResolvedRule } from "../rules/types.js";
import { evaluateImportBoundary } from "./import-boundary.js";
import type { EvaluateOptions, EvaluationResult, Violation } from "./types.js";

export function evaluate(
	imports: ImportInfo[],
	rules: ResolvedRule[],
	rootDir: string,
	options: EvaluateOptions = {},
): EvaluationResult {
	const violations: Violation[] = [];
	const checkedFiles = new Set<string>();

	for (const importInfo of imports) {
		checkedFiles.add(importInfo.sourceFile);

		const violation = evaluateImportBoundary(importInfo, rules, rootDir, options);
		if (violation) {
			violations.push(violation);
		}
	}

	return {
		violations,
		filesChecked: checkedFiles.size,
		importsChecked: imports.length,
	};
}

export { evaluateImportBoundary } from "./import-boundary.js";
export type { EvaluationResult, Violation } from "./types.js";
