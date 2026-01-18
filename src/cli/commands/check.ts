import path from "node:path";
import { collectImports } from "../../core/import-collector.js";
import { createProject } from "../../core/project.js";
import { evaluate } from "../../evaluator/index.js";
import { reportToConsole } from "../../reporter/console.js";
import { loadRulesForDirectory } from "../../rules/loader.js";
import { resolveRules } from "../../rules/resolver.js";

export interface CheckOptions {
	config?: string;
	color?: boolean;
}

export async function checkCommand(targetPath: string, options: CheckOptions): Promise<void> {
	const absolutePath = path.resolve(targetPath);

	console.log(`Checking import boundaries in: ${absolutePath}\n`);

	try {
		const project = createProject({
			tsConfigFilePath: options.config,
			rootDir: absolutePath,
		});

		const imports = collectImports(project, absolutePath);

		if (imports.length === 0) {
			console.log("No imports found to check.");
			process.exit(0);
		}

		const rulesByDir = await loadRulesForDirectory(absolutePath);
		const resolvedRules = resolveRules(rulesByDir);

		const results = evaluate(imports, resolvedRules, absolutePath);

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
