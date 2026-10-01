import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadRules } from "./loader.js";

describe("loadRules - error messages", () => {
	let directory: string;
	let ruleFile: string;

	beforeEach(() => {
		directory = fs.mkdtempSync(path.join(os.tmpdir(), "zonefence-loader-"));
		ruleFile = path.join(directory, "zonefence.yaml");
	});

	afterEach(() => {
		fs.rmSync(directory, { recursive: true, force: true });
	});

	function load(content: string): unknown {
		fs.writeFileSync(ruleFile, content);
		return loadRules(ruleFile);
	}

	it("should name the file and the mistyped key of an import rule", () => {
		const content = 'version: 1\nimports:\n  deny:\n    - from: "hono"\n      mesage: "typo"\n';

		expect(() => load(content)).toThrow(
			`Invalid configuration in ${ruleFile}\n  imports.deny.0: unknown key "mesage"`,
		);
	});

	it("should name the file when the YAML itself is malformed", () => {
		expect(() => load("version: 1\nimports:\n  allow: [unclosed\n")).toThrow(
			`Invalid YAML in ${ruleFile}`,
		);
	});

	it("should still accept a bare string as an import rule", () => {
		expect(load('version: 1\nimports:\n  allow:\n    - "./**"\n')).toMatchObject({
			imports: { allow: [{ from: "./**" }] },
		});
	});
});
