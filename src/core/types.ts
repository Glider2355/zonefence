export interface ProjectOptions {
	tsConfigFilePath?: string;
	rootDir: string;
}

/** `type` for imports that are erased at compile time, `value` otherwise. */
export type ImportKind = "type" | "value";

export interface ImportInfo {
	/** The file containing the import statement */
	sourceFile: string;
	/** The original module specifier as written in the code */
	moduleSpecifier: string;
	/** The resolved absolute path (if resolvable), otherwise the original specifier */
	resolvedPath: string | null;
	/** Whether this is an external package import */
	isExternal: boolean;
	/** Line number of the import statement */
	line: number;
	/** Column number of the import statement */
	column: number;
	/** Whether the import is type-only. Treated as `value` when omitted. */
	kind?: ImportKind;
}

/**
 * A dynamic `import()` / `require()` call whose specifier is not a string literal,
 * so there is nothing to match a rule against.
 */
export interface UnanalyzableImport {
	/** The file containing the call */
	sourceFile: string;
	/** The call as written, e.g. "import(`./${name}.js`)" */
	expression: string;
	/** Line number of the call */
	line: number;
	/** Column number of the call */
	column: number;
}

export interface CollectedImports {
	imports: ImportInfo[];
	unanalyzable: UnanalyzableImport[];
}
