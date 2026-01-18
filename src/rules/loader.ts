import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { parseConfig } from "./schema.js";
import type { RulesByDirectory, ZoneFenceConfig } from "./types.js";

const RULE_FILE_NAME = ".zonefence.yaml";

export async function loadRulesForDirectory(rootDir: string): Promise<RulesByDirectory> {
	const rules: RulesByDirectory = {};

	await scanDirectory(rootDir, rootDir, rules);

	return rules;
}

async function scanDirectory(
	currentDir: string,
	rootDir: string,
	rules: RulesByDirectory,
): Promise<void> {
	const ruleFilePath = path.join(currentDir, RULE_FILE_NAME);

	if (fs.existsSync(ruleFilePath)) {
		const config = await loadRuleFile(ruleFilePath);
		rules[currentDir] = {
			config,
			ruleFilePath,
		};
	}

	// Scan subdirectories
	const entries = fs.readdirSync(currentDir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
			const subDir = path.join(currentDir, entry.name);
			await scanDirectory(subDir, rootDir, rules);
		}
	}
}

async function loadRuleFile(filePath: string): Promise<ZoneFenceConfig> {
	const content = fs.readFileSync(filePath, "utf-8");
	const parsed = parseYaml(content);
	return parseConfig(parsed);
}

function shouldSkipDirectory(name: string): boolean {
	const skipDirs = ["node_modules", ".git", "dist", "build", "coverage"];
	return skipDirs.includes(name) || name.startsWith(".");
}

export function loadRules(filePath: string): ZoneFenceConfig {
	const content = fs.readFileSync(filePath, "utf-8");
	const parsed = parseYaml(content);
	return parseConfig(parsed);
}
