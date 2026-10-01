import fs from "node:fs";
import path from "node:path";

const SKIPPED_DIRECTORIES = ["node_modules", ".git", "dist", "build", "coverage"];
const RULE_FILE_NAME = "zonefence.yaml";

export function shouldSkipDirectory(name: string): boolean {
	return SKIPPED_DIRECTORIES.includes(name) || name.startsWith(".");
}

/**
 * List every file under `rootDir` that file placement rules apply to: all files
 * regardless of extension, except dotfiles and the rule files themselves.
 */
export function collectFiles(rootDir: string): string[] {
	const files: string[] = [];
	const pending = [rootDir];

	for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const entryPath = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				if (!shouldSkipDirectory(entry.name)) {
					pending.push(entryPath);
				}
			} else if (entry.isFile() && !entry.name.startsWith(".") && entry.name !== RULE_FILE_NAME) {
				files.push(entryPath);
			}
		}
	}

	return files.sort();
}
