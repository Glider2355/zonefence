import path from "node:path";
import { minimatch } from "minimatch";
import type { ResolvedRule } from "../rules/types.js";

export function findApplicableRule(filePath: string, rules: ResolvedRule[]): ResolvedRule | null {
	// Find the most specific rule (deepest directory) that applies to this file
	let mostSpecific: ResolvedRule | null = null;

	for (const rule of rules) {
		const relative = path.relative(rule.directory, filePath);
		// Check if file is within this directory
		if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
			if (!mostSpecific || rule.directory.length > mostSpecific.directory.length) {
				mostSpecific = rule;
			}
		}
	}

	return mostSpecific;
}

export function isExcluded(filePath: string, rule: ResolvedRule, rootDir: string): boolean {
	const relativePath = path.relative(rootDir, filePath);

	for (const pattern of rule.excludePatterns) {
		if (minimatch(relativePath, pattern) || minimatch(path.basename(filePath), pattern)) {
			return true;
		}
	}

	return false;
}
