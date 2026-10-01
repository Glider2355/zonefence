import type { UnanalyzableImport } from "../core/types.js";

export type Severity = "error" | "warning";

export type ViolationRule = "import-boundary" | "file-placement" | "dynamic-import";

export interface Violation {
	/** The file containing the violation */
	sourceFile: string;
	/** The import module specifier that caused the violation (import violations only) */
	moduleSpecifier?: string;
	/** Line number of the violation */
	line: number;
	/** Column number of the violation */
	column: number;
	/** The rule that was violated */
	rule: ViolationRule;
	/** Only errors fail the check. Treated as `error` when omitted. */
	severity?: Severity;
	/** Error message */
	message: string;
	/** Path to the rule file that defined this rule */
	ruleFilePath: string;
	/** Optional design intent from the rule description */
	designIntent?: string;
	/** Optional fix suggestion */
	suggestion?: string;
}

export interface EvaluationResult {
	/** List of violations found */
	violations: Violation[];
	/** Number of files checked */
	filesChecked: number;
	/** Number of imports checked */
	importsChecked: number;
}

/**
 * Mapping from path aliases to their resolved paths
 * e.g., { "@/*": ["./src/*"] }
 */
export type PathsMapping = Record<string, string[]>;

export interface EvaluateOptions {
	/** Path alias mapping from tsconfig.json */
	pathsMapping?: PathsMapping;
	/** All files under the checked root, for `files.allow` / `files.require` */
	files?: string[];
	/** Dynamic imports with a non-literal specifier, reported as warnings */
	unanalyzableImports?: UnanalyzableImport[];
	/** Report warnings as errors */
	strict?: boolean;
}
