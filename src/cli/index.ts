#!/usr/bin/env node

import { Command } from "commander";
import { checkCommand } from "./commands/check.js";

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
	.action(checkCommand);

program.parse();
