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

	const properties = `file=${file},line=${violation.line},col=${violation.column},title=${title}`;

	return `::error ${properties}::${escapeData(messageParts.join("\n"))}`;
}

export function reportToGithub(result: EvaluationResult, cwd: string = process.cwd()): number {
	for (const violation of result.violations) {
		console.log(formatGithubAnnotation(violation, cwd));
	}

	return result.violations.length > 0 ? 1 : 0;
}
