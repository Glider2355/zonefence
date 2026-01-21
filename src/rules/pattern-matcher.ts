import path from "node:path";
import { minimatch } from "minimatch";
import type { DirectoryPatternRule, PatternRuleConfig } from "./types.js";

export interface PatternMatch {
	pattern: string;
	config: PatternRuleConfig;
	priority: number;
	sourceFile: string;
	specificity: number;
}

export interface DirectoryPatternSource {
	sourceFile: string;
	sourceDir: string;
	patterns: DirectoryPatternRule[];
}

/**
 * Check if a directory matches a pattern, scoped to the source directory
 */
export function matchDirectoryPattern(
	targetDir: string,
	pattern: string,
	sourceDir: string,
): boolean {
	const relativePath = path.relative(sourceDir, targetDir);

	// Target must be within source directory (not equal, not outside)
	if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		return false;
	}

	return minimatch(relativePath, pattern, { dot: false });
}

/**
 * Calculate the specificity of a pattern (higher = more specific)
 * More specific patterns should take precedence
 */
export function calculateSpecificity(pattern: string): number {
	let specificity = 0;

	// Count literal path segments (non-wildcard)
	const segments = pattern.split("/");
	for (const segment of segments) {
		if (segment === "**") {
			// Double wildcard is least specific
			specificity += 1;
		} else if (segment === "*") {
			// Single wildcard is more specific than **
			specificity += 5;
		} else if (segment.includes("*")) {
			// Partial wildcard (e.g., "containers*")
			specificity += 8;
		} else {
			// Literal segment is most specific
			specificity += 10;
		}
	}

	return specificity;
}

/**
 * Find all pattern rules that apply to a target directory
 */
export function findMatchingPatterns(
	targetDir: string,
	patternSources: DirectoryPatternSource[],
): PatternMatch[] {
	const matches: PatternMatch[] = [];

	for (const source of patternSources) {
		for (const rule of source.patterns) {
			if (matchDirectoryPattern(targetDir, rule.pattern, source.sourceDir)) {
				matches.push({
					pattern: rule.pattern,
					config: rule.config,
					priority: rule.priority ?? 0,
					sourceFile: source.sourceFile,
					specificity: calculateSpecificity(rule.pattern),
				});
			}
		}
	}

	// Sort by priority (higher first), then by specificity (higher first)
	matches.sort((a, b) => {
		if (a.priority !== b.priority) {
			return b.priority - a.priority;
		}
		return b.specificity - a.specificity;
	});

	return matches;
}

/**
 * Collect all directory pattern sources from loaded rules
 */
export function collectPatternSources(rulesByDirectory: {
	[directory: string]: {
		config: { directoryPatterns?: DirectoryPatternRule[] };
		ruleFilePath: string;
	};
}): DirectoryPatternSource[] {
	const sources: DirectoryPatternSource[] = [];

	for (const [directory, { config, ruleFilePath }] of Object.entries(rulesByDirectory)) {
		if (config.directoryPatterns && config.directoryPatterns.length > 0) {
			sources.push({
				sourceFile: ruleFilePath,
				sourceDir: directory,
				patterns: config.directoryPatterns,
			});
		}
	}

	return sources;
}
