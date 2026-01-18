export interface ProjectOptions {
	tsConfigFilePath?: string;
	rootDir: string;
}

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
}
