import fs from "node:fs";
import path from "node:path";
import type { Project } from "ts-morph";
import { collectImports } from "../../core/import-collector.js";
import { createProject } from "../../core/project.js";
import { evaluate } from "../../evaluator/index.js";
import type { PathsMapping } from "../../evaluator/types.js";
import { reportToConsole } from "../../reporter/console.js";
import { loadRulesForDirectoryWithAllDirs } from "../../rules/loader.js";
import { resolveRulesWithPatterns } from "../../rules/resolver.js";

export interface CheckOptions {
	config?: string;
	color?: boolean;
}

/**
 * Find tsconfig.json by searching upward from the start directory
 */
function findTsConfig(startDir: string): string | undefined {
	let dir = startDir;
	while (dir !== path.dirname(dir)) {
		const configPath = path.join(dir, "tsconfig.json");
		if (fs.existsSync(configPath)) {
			return configPath;
		}
		dir = path.dirname(dir);
	}
	return undefined;
}

/**
 * Extract paths mapping from ts-morph project, adjusted for rootDir
 */
function getPathsMapping(
	project: Project,
	rootDir: string,
	tsConfigFilePath?: string,
): PathsMapping | undefined {
	const compilerOptions = project.getCompilerOptions();
	const originalPaths = compilerOptions?.paths as PathsMapping | undefined;

	if (!originalPaths || !tsConfigFilePath) {
		return originalPaths;
	}

	// tsconfig.json directory
	const tsConfigDir = path.dirname(tsConfigFilePath);

	// Adjust paths targets to be relative to rootDir
	const adjustedPaths: PathsMapping = {};
	for (const [alias, targets] of Object.entries(originalPaths)) {
		adjustedPaths[alias] = targets.map((target) => {
			// target is relative to tsconfig.json (e.g., "./src/*")
			const targetWithoutGlob = target.replace(/\*$/, "");
			const absoluteTarget = path.resolve(tsConfigDir, targetWithoutGlob);
			const relativeToRoot = path.relative(rootDir, absoluteTarget);
			// Add back the glob if it existed
			return (relativeToRoot || ".") + (target.endsWith("*") ? "/*" : "");
		});
	}

	return adjustedPaths;
}

export async function checkCommand(targetPath: string, options: CheckOptions): Promise<void> {
	const absolutePath = path.resolve(targetPath);

	console.log(`Checking import boundaries in: ${absolutePath}\n`);

	try {
		// Use provided config or auto-detect tsconfig.json
		const tsConfigFilePath = options.config ?? findTsConfig(absolutePath);

		const project = createProject({
			tsConfigFilePath,
			rootDir: absolutePath,
		});

		const imports = collectImports(project, absolutePath);

		if (imports.length === 0) {
			console.log("No imports found to check.");
			process.exit(0);
		}

		const { rules, allDirectories } = await loadRulesForDirectoryWithAllDirs(absolutePath);
		const resolvedRules = resolveRulesWithPatterns(rules, allDirectories);

		// Get paths mapping from tsconfig for pattern resolution
		const pathsMapping = getPathsMapping(project, absolutePath, tsConfigFilePath);

		const results = evaluate(imports, resolvedRules, absolutePath, { pathsMapping });

		const exitCode = reportToConsole(results, {
			color: options.color !== false,
		});

		process.exit(exitCode);
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error("An unknown error occurred");
		}
		process.exit(1);
	}
}
