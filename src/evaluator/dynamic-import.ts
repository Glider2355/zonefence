import type { UnanalyzableImport } from "../core/types.js";
import type { ResolvedRule } from "../rules/types.js";
import { findApplicableRule, isExcluded } from "./rule-lookup.js";
import type { Severity, Violation } from "./types.js";

const MAX_EXPRESSION_LENGTH = 80;

/**
 * Report dynamic `import()` / `require()` calls whose specifier is not a string
 * literal. They cannot be matched against a rule, so inside a fenced directory
 * they are a hole in the fence: a warning by default, an error in strict mode.
 */
export function evaluateUnanalyzableImports(
	unanalyzable: UnanalyzableImport[],
	rules: ResolvedRule[],
	rootDir: string,
	severity: Severity,
): Violation[] {
	const violations: Violation[] = [];

	for (const call of unanalyzable) {
		const rule = findApplicableRule(call.sourceFile, rules);

		if (!rule || !hasImportRules(rule) || isExcluded(call.sourceFile, rule, rootDir)) {
			continue;
		}

		violations.push({
			sourceFile: call.sourceFile,
			line: call.line,
			column: call.column,
			rule: "dynamic-import",
			severity,
			message: `Cannot check ${summarize(call.expression)}: the specifier is not a string literal`,
			ruleFilePath: rule.ruleFilePath,
			designIntent: rule.config.description,
		});
	}

	return violations;
}

function hasImportRules(rule: ResolvedRule): boolean {
	const imports = rule.config.imports;
	return (imports?.allow?.length ?? 0) > 0 || (imports?.deny?.length ?? 0) > 0;
}

function summarize(expression: string): string {
	const singleLine = expression.replace(/\s+/g, " ");
	return singleLine.length > MAX_EXPRESSION_LENGTH
		? `${singleLine.slice(0, MAX_EXPRESSION_LENGTH - 1)}…`
		: singleLine;
}
