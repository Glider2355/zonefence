import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { validateConfig } from "./schema.js";
import type { RulesByDirectory, ZoneFenceConfig } from "./types.js";

const RULE_FILE_NAME = "zonefence.yaml";

export interface LoadRulesResult {
	rules: RulesByDirectory;
	allDirectories: string[];
}

export async function loadRulesForDirectory(rootDir: string): Promise<RulesByDirectory> {
	const result = await loadRulesForDirectoryWithAllDirs(rootDir);
	return result.rules;
}

export async function loadRulesForDirectoryWithAllDirs(rootDir: string): Promise<LoadRulesResult> {
	const rules: RulesByDirectory = {};
	const allDirectories: string[] = [];

	await scanDirectory(rootDir, rootDir, rules, allDirectories);

	return { rules, allDirectories };
}

async function scanDirectory(
	currentDir: string,
	rootDir: string,
	rules: RulesByDirectory,
	allDirectories: string[],
): Promise<void> {
	allDirectories.push(currentDir);
	const ruleFilePath = path.join(currentDir, RULE_FILE_NAME);

	if (fs.existsSync(ruleFilePath)) {
		const config = parseRuleFile(ruleFilePath);
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
			await scanDirectory(subDir, rootDir, rules, allDirectories);
		}
	}
}

/**
 * Turn a ZodError into a message that names the offending file and keys, so that
 * a typo like `reason:`/`mesage:` is actionable instead of a raw JSON dump.
 */
function formatConfigError(filePath: string, error: z.ZodError): string {
	const details = error.issues
		.map((issue) => {
			const location = issue.path.length > 0 ? issue.path.join(".") : "(root)";
			if (issue.code === "unrecognized_keys") {
				const keys = issue.keys.map((key) => `"${key}"`).join(", ");
				return `  ${location}: unknown key ${keys}`;
			}
			return `  ${location}: ${issue.message}`;
		})
		.join("\n");

	return `Invalid configuration in ${filePath}\n${details}`;
}

function parseRuleFile(filePath: string): ZoneFenceConfig {
	const content = fs.readFileSync(filePath, "utf-8");
	const parsed = parseYaml(content);
	const result = validateConfig(parsed);

	if (!result.success) {
		throw new Error(formatConfigError(filePath, result.error));
	}

	return result.data;
}

function shouldSkipDirectory(name: string): boolean {
	const skipDirs = ["node_modules", ".git", "dist", "build", "coverage"];
	return skipDirs.includes(name) || name.startsWith(".");
}

export function loadRules(filePath: string): ZoneFenceConfig {
	return parseRuleFile(filePath);
}
