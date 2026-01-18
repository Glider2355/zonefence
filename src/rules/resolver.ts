import path from "node:path";
import type { ImportRule, ResolvedRule, RulesByDirectory, ZoneFenceConfig } from "./types.js";

export function resolveRules(rulesByDirectory: RulesByDirectory): ResolvedRule[] {
	const resolvedRules: ResolvedRule[] = [];
	const directories = Object.keys(rulesByDirectory).sort((a, b) => a.length - b.length);

	for (const directory of directories) {
		const { config, ruleFilePath } = rulesByDirectory[directory];

		// Find parent rules
		const parentRules = findParentRules(directory, directories, rulesByDirectory);

		// Merge with parent rules
		const mergedConfig = mergeConfigs(parentRules, config);

		// Collect exclude patterns
		const excludePatterns = collectExcludePatterns(mergedConfig);

		resolvedRules.push({
			directory,
			ruleFilePath,
			config: mergedConfig,
			excludePatterns,
		});
	}

	return resolvedRules;
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
