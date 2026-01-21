import path from "node:path";
import { minimatch } from "minimatch";
import type { ImportInfo } from "../core/types.js";
import type { ImportRule, ResolvedRule } from "../rules/types.js";
import type { EvaluateOptions, PathsMapping, Violation } from "./types.js";

export function evaluateImportBoundary(
	importInfo: ImportInfo,
	rules: ResolvedRule[],
	rootDir: string,
	options: EvaluateOptions = {},
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

	const isExternal = importInfo.isExternal;

	const moduleSpecifier = importInfo.moduleSpecifier;
	const pathsMapping = options.pathsMapping;

	if (mode === "allow-first") {
		// Check deny rules first, then allow rules
		const denyMatch = findMatchingRule(
			pathToMatch,
			moduleSpecifier,
			denyRules,
			importInfo.sourceFile,
			rootDir,
			isExternal,
			pathsMapping,
		);
		if (denyMatch) {
			return createViolation(importInfo, denyMatch, ruleFilePath, config.description);
		}

		// If there are allow rules, import must match at least one
		if (allowRules.length > 0) {
			const allowMatch = findMatchingRule(
				pathToMatch,
				moduleSpecifier,
				allowRules,
				importInfo.sourceFile,
				rootDir,
				isExternal,
				pathsMapping,
			);
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
		const allowMatch = findMatchingRule(
			pathToMatch,
			moduleSpecifier,
			allowRules,
			importInfo.sourceFile,
			rootDir,
			isExternal,
			pathsMapping,
		);
		if (allowMatch) {
			return null;
		}

		const denyMatch = findMatchingRule(
			pathToMatch,
			moduleSpecifier,
			denyRules,
			importInfo.sourceFile,
			rootDir,
			isExternal,
			pathsMapping,
		);
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
	moduleSpecifier: string,
	rules: ImportRule[],
	sourceFile: string,
	rootDir: string,
	isExternal: boolean,
	pathsMapping?: PathsMapping,
): ImportRule | null {
	for (const rule of rules) {
		// First, try matching against the resolved path
		if (matchesPattern(pathToMatch, rule.from, sourceFile, rootDir, isExternal, pathsMapping)) {
			return rule;
		}
		// Also try matching against the original module specifier
		// This allows patterns like "@/api/**" or "@image-router/*" to work
		if (
			pathToMatch !== moduleSpecifier &&
			matchesPattern(moduleSpecifier, rule.from, sourceFile, rootDir, isExternal, pathsMapping)
		) {
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

/**
 * Resolve a pattern using tsconfig paths mapping
 * e.g., "@/api/**" with paths {"@/*": ["./src/*"]} -> "src/api/**"
 */
function resolvePatternWithPaths(pattern: string, pathsMapping?: PathsMapping): string[] {
	if (!pathsMapping) {
		return [pattern];
	}

	const resolvedPatterns: string[] = [pattern];

	for (const [alias, targets] of Object.entries(pathsMapping)) {
		// Convert alias pattern to regex (e.g., "@/*" -> "^@/(.*)$")
		const aliasBase = alias.replace(/\*$/, "");
		if (pattern.startsWith(aliasBase)) {
			const remainder = pattern.slice(aliasBase.length);
			for (const target of targets) {
				// Convert target pattern (e.g., "./src/*" -> "src/")
				const targetBase = target.replace(/^\.\//, "").replace(/\*$/, "");
				resolvedPatterns.push(targetBase + remainder);
			}
		}
	}

	return resolvedPatterns;
}

function matchesPattern(
	pathToMatch: string,
	pattern: string,
	sourceFile: string,
	rootDir: string,
	isExternal: boolean,
	pathsMapping?: PathsMapping,
): boolean {
	// Handle relative patterns (starting with ./)
	if (pattern.startsWith("./") || pattern.startsWith("../")) {
		// Convert pathToMatch to be relative to sourceDir instead of rootDir
		// This avoids issues with special characters like [id] in Next.js dynamic routes
		const sourceDir = path.dirname(sourceFile);
		const absolutePathToMatch = path.resolve(rootDir, pathToMatch);
		let relativePathToMatch = path.relative(sourceDir, absolutePathToMatch);
		// Prepend ./ if the path doesn't start with .. to match patterns like "./**"
		if (!relativePathToMatch.startsWith("..")) {
			relativePathToMatch = `./${relativePathToMatch}`;
		}
		return minimatch(relativePathToMatch, pattern);
	}

	// Get all possible patterns (original + resolved via paths)
	const patternsToTry = resolvePatternWithPaths(pattern, pathsMapping);

	for (const currentPattern of patternsToTry) {
		// Handle glob patterns
		if (currentPattern.includes("*")) {
			if (isExternal) {
				// For external packages, also match against the package name
				// e.g., pattern "lodash/*" should match "lodash/get"
				const packageName = getPackageName(pathToMatch);
				if (minimatch(packageName, currentPattern)) {
					return true;
				}
			}
			// For internal paths (and external full path match), use direct minimatch
			if (minimatch(pathToMatch, currentPattern)) {
				return true;
			}
			continue;
		}

		// For non-glob patterns, extract package names and compare
		const pathPackageName = getPackageName(pathToMatch);
		const patternPackageName = getPackageName(currentPattern);

		// Exact package match or subpath of the same package
		if (pathPackageName === patternPackageName) {
			// If pattern is the full package name, allow any subpath
			if (currentPattern === patternPackageName) {
				return true;
			}
			// If pattern includes subpath, require exact match or subpath
			if (pathToMatch === currentPattern || pathToMatch.startsWith(`${currentPattern}/`)) {
				return true;
			}
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
