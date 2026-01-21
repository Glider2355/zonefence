import path from "node:path";
import {
	type PatternMatch,
	collectPatternSources,
	findMatchingPatterns,
} from "./pattern-matcher.js";
import type { ImportRule, ResolvedRule, RulesByDirectory, ZoneFenceConfig } from "./types.js";

export function resolveRules(rulesByDirectory: RulesByDirectory): ResolvedRule[] {
	const resolvedRules: ResolvedRule[] = [];
	const directories = Object.keys(rulesByDirectory).sort((a, b) => a.length - b.length);
	const patternSources = collectPatternSources(rulesByDirectory);

	for (const directory of directories) {
		const { config, ruleFilePath } = rulesByDirectory[directory];

		// Find parent rules
		const parentRules = findParentRules(directory, directories, rulesByDirectory);

		// Merge with parent rules
		let mergedConfig = mergeConfigs(parentRules, config);

		// Apply pattern rules (pattern rules have lower priority than direct zonefence.yaml)
		const patternMatches = findMatchingPatterns(directory, patternSources);
		const appliedPatternRules: ResolvedRule["appliedPatternRules"] = [];

		if (patternMatches.length > 0) {
			// Apply pattern rules first (lowest priority)
			let patternConfig = createEmptyConfig(mergedConfig.version);
			for (const match of [...patternMatches].reverse()) {
				patternConfig = applyPatternRule(patternConfig, match);
				appliedPatternRules.unshift({
					pattern: match.pattern,
					sourceFile: match.sourceFile,
					priority: match.priority,
				});
			}
			// Then merge with the directory's own config (highest priority)
			mergedConfig = mergeTwoConfigs(patternConfig, mergedConfig);
		}

		// Collect exclude patterns
		const excludePatterns = collectExcludePatterns(mergedConfig);

		resolvedRules.push({
			directory,
			ruleFilePath,
			config: mergedConfig,
			excludePatterns,
			appliedPatternRules: appliedPatternRules.length > 0 ? appliedPatternRules : undefined,
		});
	}

	return resolvedRules;
}

/**
 * Resolve rules including directories that only match patterns (no zonefence.yaml)
 * This scans for directories that match patterns defined in parent zonefence.yaml files
 */
export function resolveRulesWithPatterns(
	rulesByDirectory: RulesByDirectory,
	allDirectories: string[],
): ResolvedRule[] {
	const patternSources = collectPatternSources(rulesByDirectory);
	const directoriesWithRules = new Set(Object.keys(rulesByDirectory));

	// Find directories that match patterns but don't have their own zonefence.yaml
	const patternOnlyDirectories: string[] = [];
	for (const dir of allDirectories) {
		if (!directoriesWithRules.has(dir)) {
			const matches = findMatchingPatterns(dir, patternSources);
			if (matches.length > 0) {
				patternOnlyDirectories.push(dir);
			}
		}
	}

	// Create a combined rules object with pattern-only directories
	const combinedRules: RulesByDirectory = { ...rulesByDirectory };
	for (const dir of patternOnlyDirectories) {
		const matches = findMatchingPatterns(dir, patternSources);
		if (matches.length > 0) {
			// Use the first matching pattern's source file as the rule file path
			combinedRules[dir] = {
				config: { version: 1 },
				ruleFilePath: matches[0].sourceFile,
			};
		}
	}

	// Now resolve all rules (including pattern-only directories)
	const resolvedRules: ResolvedRule[] = [];
	const directories = Object.keys(combinedRules).sort((a, b) => a.length - b.length);

	for (const directory of directories) {
		const { config, ruleFilePath } = combinedRules[directory];
		const hasOwnConfig = directoriesWithRules.has(directory);

		// Find parent rules
		const parentRules = findParentRules(directory, directories, combinedRules);

		// Merge with parent rules
		let mergedConfig = mergeConfigs(parentRules, config);

		// Apply pattern rules
		const patternMatches = findMatchingPatterns(directory, patternSources);
		const appliedPatternRules: ResolvedRule["appliedPatternRules"] = [];

		if (patternMatches.length > 0) {
			// For pattern-only directories, pattern rules are the primary source
			// For directories with their own config, pattern rules have lower priority
			let patternConfig = createEmptyConfig(mergedConfig.version);
			for (const match of [...patternMatches].reverse()) {
				patternConfig = applyPatternRule(patternConfig, match);
				appliedPatternRules.unshift({
					pattern: match.pattern,
					sourceFile: match.sourceFile,
					priority: match.priority,
				});
			}

			if (hasOwnConfig) {
				// Directory has its own config - it takes precedence over patterns
				mergedConfig = mergeTwoConfigs(patternConfig, mergedConfig);
			} else {
				// Pattern-only directory - patterns are merged with parent rules
				mergedConfig = mergeTwoConfigs(mergedConfig, patternConfig);
			}
		}

		// Collect exclude patterns
		const excludePatterns = collectExcludePatterns(mergedConfig);

		resolvedRules.push({
			directory,
			ruleFilePath,
			config: mergedConfig,
			excludePatterns,
			appliedPatternRules: appliedPatternRules.length > 0 ? appliedPatternRules : undefined,
		});
	}

	return resolvedRules;
}

function createEmptyConfig(version: number): ZoneFenceConfig {
	return { version };
}

function applyPatternRule(base: ZoneFenceConfig, match: PatternMatch): ZoneFenceConfig {
	const { config } = match;
	const mergeStrategy = config.mergeStrategy ?? "merge";

	if (mergeStrategy === "override") {
		// Override: pattern config completely replaces base imports
		return {
			...base,
			description: config.description ?? base.description,
			imports: config.imports
				? {
						allow: config.imports.allow ?? [],
						deny: config.imports.deny ?? [],
						mode: config.imports.mode ?? base.imports?.mode ?? "allow-first",
					}
				: base.imports,
		};
	}

	// Merge (default): combine imports
	return {
		...base,
		description: config.description ?? base.description,
		imports: {
			allow: mergeImportRules(base.imports?.allow, config.imports?.allow),
			deny: mergeImportRules(base.imports?.deny, config.imports?.deny),
			mode: config.imports?.mode ?? base.imports?.mode ?? "allow-first",
		},
	};
}

function findParentRules(
	directory: string,
	allDirectories: string[],
	rulesByDirectory: RulesByDirectory,
): ZoneFenceConfig[] {
	const parents: ZoneFenceConfig[] = [];

	for (const potentialParent of allDirectories) {
		if (potentialParent === directory) continue;

		// Check if potentialParent is an ancestor of directory
		const relative = path.relative(potentialParent, directory);
		if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
			const parentConfig = rulesByDirectory[potentialParent].config;

			// Only include if scope.apply is "descendants"
			const scopeApply = parentConfig.scope?.apply ?? "descendants";
			if (scopeApply === "descendants") {
				parents.push(parentConfig);
			}
		}
	}

	return parents;
}

function mergeConfigs(parents: ZoneFenceConfig[], child: ZoneFenceConfig): ZoneFenceConfig {
	if (parents.length === 0) {
		return child;
	}

	// Start with the first parent and merge subsequent ones
	let merged: ZoneFenceConfig = { version: child.version };

	for (const parent of parents) {
		merged = mergeTwoConfigs(merged, parent);
	}

	// Finally merge with child (child takes precedence)
	merged = mergeTwoConfigs(merged, child);

	return merged;
}

function mergeTwoConfigs(base: ZoneFenceConfig, override: ZoneFenceConfig): ZoneFenceConfig {
	const merged: ZoneFenceConfig = {
		version: override.version ?? base.version,
		description: override.description ?? base.description,
	};

	// Merge scope
	if (base.scope || override.scope) {
		merged.scope = {
			apply: override.scope?.apply ?? base.scope?.apply ?? "descendants",
			exclude: mergeArrays(base.scope?.exclude, override.scope?.exclude),
		};
	}

	// Merge imports
	if (base.imports || override.imports) {
		merged.imports = {
			allow: mergeImportRules(base.imports?.allow, override.imports?.allow),
			deny: mergeImportRules(base.imports?.deny, override.imports?.deny),
			mode: override.imports?.mode ?? base.imports?.mode ?? "allow-first",
		};
	}

	return merged;
}

function mergeArrays<T>(base?: T[], override?: T[]): T[] {
	const result: T[] = [];
	if (base) result.push(...base);
	if (override) result.push(...override);
	return result;
}

function mergeImportRules(base?: ImportRule[], override?: ImportRule[]): ImportRule[] {
	const result: ImportRule[] = [];
	if (base) result.push(...base);
	if (override) result.push(...override);
	return result;
}

function collectExcludePatterns(config: ZoneFenceConfig): string[] {
	return config.scope?.exclude ?? [];
}
