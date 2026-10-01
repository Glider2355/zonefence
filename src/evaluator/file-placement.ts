import path from "node:path";
import { escape as escapeGlob, minimatch } from "minimatch";
import type { FileRequireRule, ResolvedRule } from "../rules/types.js";
import { findApplicableRule, isExcluded } from "./rule-lookup.js";
import type { Violation } from "./types.js";

/**
 * Check `files.allow` / `files.require` for every file under the checked root.
 *
 * Patterns are matched against the path relative to the directory the rule
 * applies to; a pattern without a slash also matches the bare file name, so
 * that `route.ts` keeps working for files in nested directories.
 */
export function evaluateFilePlacement(
	files: string[],
	rules: ResolvedRule[],
	rootDir: string,
): Violation[] {
	const violations: Violation[] = [];
	const fileNamesByDirectory = groupFileNamesByDirectory(files);

	for (const filePath of files) {
		const rule = findApplicableRule(filePath, rules);
		const filesConfig = rule?.config.files;

		if (!rule || !filesConfig || isExcluded(filePath, rule, rootDir)) {
			continue;
		}

		const fileName = path.basename(filePath);
		const allow = filesConfig.allow ?? [];

		if (
			allow.length > 0 &&
			!allow.some((pattern) => matchesFilePattern(filePath, pattern, rule.directory))
		) {
			violations.push(
				createViolation(
					filePath,
					`File "${fileName}" is not allowed here (allowed: ${allow.join(", ")})`,
					rule,
				),
			);
		}

		for (const requirement of filesConfig.require ?? []) {
			if (!isSubjectTo(filePath, requirement, rule.directory)) {
				continue;
			}

			const siblings = fileNamesByDirectory.get(path.dirname(filePath)) ?? [];
			const siblingGlob = expandSiblingTemplate(requirement.sibling, fileName, escapeGlob);
			const hasSibling = siblings.some(
				(sibling) => sibling !== fileName && minimatch(sibling, siblingGlob, { dot: true }),
			);

			if (!hasSibling) {
				const expected = expandSiblingTemplate(requirement.sibling, fileName, (value) => value);
				violations.push(
					createViolation(
						filePath,
						requirement.message ?? `Missing "${expected}" next to "${fileName}"`,
						rule,
					),
				);
			}
		}
	}

	return violations;
}

function groupFileNamesByDirectory(files: string[]): Map<string, string[]> {
	const grouped = new Map<string, string[]>();

	for (const filePath of files) {
		const directory = path.dirname(filePath);
		const names = grouped.get(directory);
		if (names) {
			names.push(path.basename(filePath));
		} else {
			grouped.set(directory, [path.basename(filePath)]);
		}
	}

	return grouped;
}

function matchesFilePattern(filePath: string, pattern: string, baseDir: string): boolean {
	if (minimatch(path.relative(baseDir, filePath), pattern, { dot: true })) {
		return true;
	}

	return !pattern.includes("/") && minimatch(path.basename(filePath), pattern, { dot: true });
}

function isSubjectTo(filePath: string, requirement: FileRequireRule, baseDir: string): boolean {
	if (!matchesFilePattern(filePath, requirement.for, baseDir)) {
		return false;
	}

	return !(requirement.exclude ?? []).some((pattern) =>
		matchesFilePattern(filePath, pattern, baseDir),
	);
}

/**
 * Expand the placeholders of a sibling template for a given file name.
 *
 * - `{name}`: file name without its last extension (`Button.test.tsx` -> `Button.test`)
 * - `{stem}`: file name up to the first dot (`Button.test.tsx` -> `Button`)
 * - `{ext}`: last extension without the dot (`Button.test.tsx` -> `tsx`)
 *
 * The rest of the template is a glob, so `{stem}.{ts,tsx}` accepts either source file.
 */
function expandSiblingTemplate(
	template: string,
	fileName: string,
	transform: (value: string) => string,
): string {
	const extension = path.extname(fileName);
	const name = extension ? fileName.slice(0, -extension.length) : fileName;
	// A leading dot belongs to the stem (".env.local" -> ".env")
	const firstDot = fileName.indexOf(".", 1);
	const stem = firstDot === -1 ? fileName : fileName.slice(0, firstDot);

	return template
		.replaceAll("{name}", transform(name))
		.replaceAll("{stem}", transform(stem))
		.replaceAll("{ext}", transform(extension.slice(1)));
}

function createViolation(filePath: string, message: string, rule: ResolvedRule): Violation {
	return {
		sourceFile: filePath,
		line: 1,
		column: 0,
		rule: "file-placement",
		message,
		ruleFilePath: rule.ruleFilePath,
		designIntent: rule.config.description,
	};
}
