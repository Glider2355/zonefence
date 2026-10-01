import path from "node:path";
import type { EvaluationResult, Violation } from "../evaluator/types.js";

/**
 * Escape a workflow command property value.
 * https://docs.github.com/actions/reference/workflow-commands-for-github-actions
 */
function escapeProperty(value: string): string {
	return value
		.replace(/%/g, "%25")
		.replace(/\r/g, "%0D")
		.replace(/\n/g, "%0A")
		.replace(/:/g, "%3A")
		.replace(/,/g, "%2C");
}

/** Escape a workflow command message body. */
function escapeData(value: string): string {
	return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

/**
 * Format one violation as a GitHub Actions error annotation, so that it shows up
 * on the offending line of a pull request.
 */
export function formatGithubAnnotation(violation: Violation, cwd: string = process.cwd()): string {
	const file = escapeProperty(path.relative(cwd, violation.sourceFile));
	const title = escapeProperty(`zonefence(${violation.rule})`);
	const messageParts = [violation.message];

	if (violation.designIntent) {
		messageParts.push(`Design intent: ${violation.designIntent}`);
	}

	messageParts.push(`Rule: ${path.relative(cwd, violation.ruleFilePath)}`);

	// Violation columns are 0-based; annotation columns are 1-based
	const column = violation.column + 1;
	const properties = `file=${file},line=${violation.line},col=${column},title=${title}`;

	return `::error ${properties}::${escapeData(messageParts.join("\n"))}`;
}

/**
 * Annotations are attached by path relative to the repository root, which is not
 * the working directory when the check runs inside a package of a monorepo.
 */
function annotationRoot(): string {
	return process.env.GITHUB_WORKSPACE || process.cwd();
}

export function reportToGithub(result: EvaluationResult, cwd: string = annotationRoot()): number {
	for (const violation of result.violations) {
		console.log(formatGithubAnnotation(violation, cwd));
	}

	return result.violations.length > 0 ? 1 : 0;
}
