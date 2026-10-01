#!/usr/bin/env node

import { Command } from "commander";
import { DOCS_LANGUAGES } from "../docs/markdown.js";
import { REPORTER_NAMES } from "../reporter/types.js";
import { checkCommand } from "./commands/check.js";
import { docsCommand } from "./commands/docs.js";

const program = new Command();

program
	.name("zonefence")
	.description("Folder-based architecture guardrails for TypeScript projects")
	.version("0.1.0");

program
	.command("check")
	.description("Check import boundaries in the specified directory")
	.argument("[path]", "Path to check", ".")
	.option("-c, --config <path>", "Path to tsconfig.json")
	.option("--no-color", "Disable colored output")
	.option("--reporter <name>", `Output format (${REPORTER_NAMES.join(" | ")})`, "console")
	.option("--strict", "Treat warnings as errors")
	.action(checkCommand);

program
	.command("docs")
	.description("Generate a Markdown document from the zonefence.yaml files")
	.argument("[path]", "Path to document", ".")
	.option("-o, --out <file>", "Write to a file instead of stdout")
	.option("--lang <lang>", `Language of the headings (${DOCS_LANGUAGES.join(" | ")})`, "en")
	.action(docsCommand);

program.parse();
