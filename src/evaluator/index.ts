import type { ImportInfo } from "../core/types.js";
import type { ResolvedRule } from "../rules/types.js";
import { evaluateUnanalyzableImports } from "./dynamic-import.js";
import { evaluateFilePlacement } from "./file-placement.js";
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

	if (options.unanalyzableImports) {
		for (const call of options.unanalyzableImports) {
			checkedFiles.add(call.sourceFile);
		}
		violations.push(
			...evaluateUnanalyzableImports(
				options.unanalyzableImports,
				rules,
				rootDir,
				options.strict ? "error" : "warning",
			),
		);
	}

	if (options.files) {
		violations.push(...evaluateFilePlacement(options.files, rules, rootDir));
	}

	return {
		violations,
		filesChecked: checkedFiles.size,
		importsChecked: imports.length,
	};
}

export { evaluateImportBoundary } from "./import-boundary.js";
export { evaluateFilePlacement } from "./file-placement.js";
export { evaluateUnanalyzableImports } from "./dynamic-import.js";
export type { EvaluationResult, Severity, Violation, ViolationRule } from "./types.js";
