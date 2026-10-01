import fs from "node:fs";
import path from "node:path";
import { DOCS_LANGUAGES, generateDocs, isDocsLanguage } from "../../docs/markdown.js";
import { loadRulesForDirectory } from "../../rules/loader.js";

export interface DocsCommandOptions {
	out?: string;
	lang?: string;
}

export async function docsCommand(targetPath: string, options: DocsCommandOptions): Promise<void> {
	const absolutePath = path.resolve(targetPath);

	try {
		const lang = options.lang ?? "en";
		if (!isDocsLanguage(lang)) {
			throw new Error(`Unknown language "${lang}". Expected one of: ${DOCS_LANGUAGES.join(", ")}`);
		}

		const rules = await loadRulesForDirectory(absolutePath);
		if (Object.keys(rules).length === 0) {
			throw new Error(`No zonefence.yaml found in: ${absolutePath}`);
		}

		const markdown = generateDocs(rules, { lang });

		if (options.out) {
			const outPath = path.resolve(options.out);
			fs.mkdirSync(path.dirname(outPath), { recursive: true });
			fs.writeFileSync(outPath, markdown);
			console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
		} else {
			process.stdout.write(markdown);
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error("An unknown error occurred");
		}
		process.exit(1);
	}
}
