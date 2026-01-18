import path from "node:path";
import chalk from "chalk";
import type { EvaluationResult, Violation } from "../evaluator/types.js";
import type { ReporterOptions } from "./types.js";

export function reportToConsole(result: EvaluationResult, options: ReporterOptions = {}): number {
	const { violations, filesChecked, importsChecked } = result;
	const useColor = options.color !== false;

	const c = useColor
		? chalk
		: {
				red: (s: string) => s,
				yellow: (s: string) => s,
				green: (s: string) => s,
				cyan: (s: string) => s,
				gray: (s: string) => s,
				bold: (s: string) => s,
				dim: (s: string) => s,
			};

	if (violations.length === 0) {
		console.log(c.green("✓ No import boundary violations found"));
		console.log(c.dim(`  Checked ${importsChecked} imports across ${filesChecked} files`));
		return 0;
	}

	// Group violations by file
	const violationsByFile = groupByFile(violations);

	for (const [filePath, fileViolations] of Object.entries(violationsByFile)) {
		console.log();
		console.log(c.bold(filePath));

		for (const violation of fileViolations) {
			const location = c.dim(`${violation.line}:${violation.column}`);
			const errorType = c.red("error");
			const rule = c.dim(`(${violation.rule})`);

			console.log(`  ${location}  ${errorType}  ${violation.message}  ${rule}`);

			if (violation.designIntent) {
				console.log(c.cyan(`    Design intent: ${violation.designIntent}`));
			}

			if (violation.suggestion) {
				console.log(c.yellow(`    Suggestion: ${violation.suggestion}`));
			}

			const ruleFile = path.relative(process.cwd(), violation.ruleFilePath);
			console.log(c.gray(`    Rule: ${ruleFile}`));
		}
	}

	console.log();

	const errorCount = violations.length;
	const fileCount = Object.keys(violationsByFile).length;
	const summary = `✖ ${errorCount} error${errorCount !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""}`;

	console.log(c.red(c.bold(summary)));

	return 1;
}

function groupByFile(violations: Violation[]): Record<string, Violation[]> {
	const grouped: Record<string, Violation[]> = {};

	for (const violation of violations) {
		const relativePath = path.relative(process.cwd(), violation.sourceFile);
		if (!grouped[relativePath]) {
			grouped[relativePath] = [];
		}
		grouped[relativePath].push(violation);
	}

	// Sort violations within each file by line number
	for (const violations of Object.values(grouped)) {
		violations.sort((a, b) => a.line - b.line || a.column - b.column);
	}

	return grouped;
}
