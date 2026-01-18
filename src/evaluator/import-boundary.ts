import path from "node:path";
import { minimatch } from "minimatch";
import type { ImportInfo } from "../core/types.js";
import type { ImportRule, ResolvedRule } from "../rules/types.js";
import type { Violation } from "./types.js";

export function evaluateImportBoundary(
	importInfo: ImportInfo,
	rules: ResolvedRule[],
	rootDir: string,
): Violation | null {
	// Find the applicable rule for this file
	const applicableRule = findApplicableRule(importInfo.sourceFile, rules);

	if (!applicableRule) {
		// No rules apply to this file, allow the import
		return null;
	}

	// Check if file is excluded
	if (isExcluded(importInfo.sourceFile, applicableRule, rootDir)) {
		return null;
	}

	const { config, ruleFilePath } = applicableRule;
	const imports = config.imports;

	if (!imports) {
		return null;
	}

	const mode = imports.mode ?? "allow-first";
	const allowRules = imports.allow ?? [];
	const denyRules = imports.deny ?? [];

	// Get the path to match against (resolved path or module specifier)
	const pathToMatch = getPathToMatch(importInfo, rootDir);

	if (mode === "allow-first") {
		// Check deny rules first, then allow rules
		const denyMatch = findMatchingRule(pathToMatch, denyRules, importInfo.sourceFile, rootDir);
		if (denyMatch) {
			return createViolation(importInfo, denyMatch, ruleFilePath, config.description);
		}

		// If there are allow rules, import must match at least one
		if (allowRules.length > 0) {
			const allowMatch = findMatchingRule(pathToMatch, allowRules, importInfo.sourceFile, rootDir);
			if (!allowMatch) {
				return createViolation(
					importInfo,
					{
						from: pathToMatch,
						message: `Import from "${importInfo.moduleSpecifier}" is not in the allow list`,
					},
					ruleFilePath,
					config.description,
				);
			}
		}
	} else {
		// deny-first: Check allow rules first, then deny rules
		const allowMatch = findMatchingRule(pathToMatch, allowRules, importInfo.sourceFile, rootDir);
		if (allowMatch) {
			return null;
		}

		const denyMatch = findMatchingRule(pathToMatch, denyRules, importInfo.sourceFile, rootDir);
		if (denyMatch) {
			return createViolation(importInfo, denyMatch, ruleFilePath, config.description);
		}

		// In deny-first mode, if no rules match, allow by default
	}

	return null;
}

function findApplicableRule(filePath: string, rules: ResolvedRule[]): ResolvedRule | null {
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

function isExcluded(filePath: string, rule: ResolvedRule, rootDir: string): boolean {
	const relativePath = path.relative(rootDir, filePath);

	for (const pattern of rule.excludePatterns) {
		if (minimatch(relativePath, pattern) || minimatch(path.basename(filePath), pattern)) {
			return true;
		}
	}

	return false;
}

function getPathToMatch(importInfo: ImportInfo, rootDir: string): string {
	// For external imports, use the module specifier
	if (importInfo.isExternal) {
		return importInfo.moduleSpecifier;
	}

	// For resolved local imports, use the relative path from root
	if (importInfo.resolvedPath) {
		return path.relative(rootDir, importInfo.resolvedPath);
	}

	// For unresolved local imports, use the module specifier
	return importInfo.moduleSpecifier;
}

function findMatchingRule(
	pathToMatch: string,
	rules: ImportRule[],
	sourceFile: string,
	rootDir: string,
): ImportRule | null {
	for (const rule of rules) {
		if (matchesPattern(pathToMatch, rule.from, sourceFile, rootDir)) {
			return rule;
		}
	}
	return null;
}

/**
 * Extract the package name from an import specifier.
 * For scoped packages like @babel/core/lib, returns @babel/core
 * For regular packages like lodash/get, returns lodash
 */
function getPackageName(moduleSpecifier: string): string {
	if (moduleSpecifier.startsWith("@")) {
		// Scoped package: @scope/package or @scope/package/subpath
		const parts = moduleSpecifier.split("/");
		if (parts.length >= 2) {
			return `${parts[0]}/${parts[1]}`;
		}
		return moduleSpecifier;
	}
	// Regular package: package or package/subpath
	return moduleSpecifier.split("/")[0];
}

function matchesPattern(
	pathToMatch: string,
	pattern: string,
	sourceFile: string,
	rootDir: string,
): boolean {
	// Handle relative patterns (starting with ./)
	if (pattern.startsWith("./") || pattern.startsWith("../")) {
		// Resolve pattern relative to source file's directory
		const sourceDir = path.dirname(sourceFile);
		const resolvedPattern = path.relative(rootDir, path.resolve(sourceDir, pattern));
		return minimatch(pathToMatch, resolvedPattern, { matchBase: true });
	}

	// Handle glob patterns
	if (pattern.includes("*")) {
		// For external packages with glob patterns, match against the package name
		// and also allow subpaths of matching packages
		const packageName = getPackageName(pathToMatch);
		if (minimatch(packageName, pattern, { matchBase: true })) {
			return true;
		}
		// Also try matching the full path for more specific patterns
		return minimatch(pathToMatch, pattern, { matchBase: true });
	}

	// For non-glob patterns, extract package names and compare
	const pathPackageName = getPackageName(pathToMatch);
	const patternPackageName = getPackageName(pattern);

	// Exact package match or subpath of the same package
	if (pathPackageName === patternPackageName) {
		// If pattern is the full package name, allow any subpath
		if (pattern === patternPackageName) {
			return true;
		}
		// If pattern includes subpath, require exact match or subpath
		if (pathToMatch === pattern || pathToMatch.startsWith(`${pattern}/`)) {
			return true;
		}
	}

	return false;
}

function createViolation(
	importInfo: ImportInfo,
	rule: ImportRule,
	ruleFilePath: string,
	designIntent?: string,
): Violation {
	return {
		sourceFile: importInfo.sourceFile,
		moduleSpecifier: importInfo.moduleSpecifier,
		line: importInfo.line,
		column: importInfo.column,
		rule: "import-boundary",
		message: rule.message ?? `Import from "${importInfo.moduleSpecifier}" is not allowed`,
		ruleFilePath,
		designIntent,
	};
}
