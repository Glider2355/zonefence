import type { ImportDeclaration, Project, SourceFile } from "ts-morph";
import type { ImportInfo } from "./types.js";

export function collectImports(project: Project, rootDir: string): ImportInfo[] {
	const imports: ImportInfo[] = [];

	for (const sourceFile of project.getSourceFiles()) {
		const fileImports = collectImportsFromFile(sourceFile, rootDir);
		imports.push(...fileImports);
	}

	return imports;
}

function collectImportsFromFile(sourceFile: SourceFile, rootDir: string): ImportInfo[] {
	const imports: ImportInfo[] = [];
	const filePath = sourceFile.getFilePath();

	for (const importDecl of sourceFile.getImportDeclarations()) {
		const importInfo = parseImportDeclaration(importDecl, filePath, rootDir);
		imports.push(importInfo);
	}

	// Also collect dynamic imports and re-exports
	for (const exportDecl of sourceFile.getExportDeclarations()) {
		const moduleSpecifier = exportDecl.getModuleSpecifier();
		if (moduleSpecifier) {
			const specifierValue = moduleSpecifier.getLiteralValue();
			const resolvedPath = resolveModulePath(exportDecl, specifierValue, filePath);
			const startLine = exportDecl.getStartLineNumber();
			const startColumn = exportDecl.getStart() - exportDecl.getStartLinePos();

			imports.push({
				sourceFile: filePath,
				moduleSpecifier: specifierValue,
				resolvedPath,
				isExternal: isExternalImport(specifierValue, resolvedPath),
				line: startLine,
				column: startColumn,
			});
		}
	}

	return imports;
}

function parseImportDeclaration(
	importDecl: ImportDeclaration,
	filePath: string,
	_rootDir: string,
): ImportInfo {
	const moduleSpecifier = importDecl.getModuleSpecifierValue();
	const resolvedPath = resolveModulePath(importDecl, moduleSpecifier, filePath);
	const startLine = importDecl.getStartLineNumber();
	const startColumn = importDecl.getStart() - importDecl.getStartLinePos();

	return {
		sourceFile: filePath,
		moduleSpecifier,
		resolvedPath,
		isExternal: isExternalImport(moduleSpecifier, resolvedPath),
		line: startLine,
		column: startColumn,
	};
}

function resolveModulePath(
	decl: ImportDeclaration | { getModuleSpecifierSourceFile: () => SourceFile | undefined },
	moduleSpecifier: string,
	_sourceFilePath: string,
): string | null {
	// Try to get the resolved source file from ts-morph
	const resolvedSourceFile = decl.getModuleSpecifierSourceFile?.();
	if (resolvedSourceFile) {
		return resolvedSourceFile.getFilePath();
	}

	// If it starts with . or /, it's a relative/absolute path that couldn't be resolved
	if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
		return null;
	}

	// External package - return null for resolved path
	return null;
}

/** @internal Exported for testing */
export function isExternalImport(moduleSpecifier: string, resolvedPath: string | null): boolean {
	// If it starts with . or /, it's a local import
	if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
		return false;
	}

	// If resolved path contains node_modules, it's an external package
	if (resolvedPath?.includes("node_modules")) {
		return true;
	}

	// If we have a resolved path that's not in node_modules, it's local
	if (resolvedPath !== null) {
		return false;
	}

	// Otherwise, it's an external package (unresolved bare specifier)
	return true;
}
