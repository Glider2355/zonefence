import path from "node:path";
import { type CallExpression, type ImportDeclaration, type Project, SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
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

	// Re-exports (`export ... from "..."`)
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

	// Dynamic `import("...")` and `require("...")` calls, which otherwise bypass
	// the fence entirely.
	imports.push(...collectCallExpressionImports(sourceFile, filePath));

	return imports;
}

/**
 * Collect `import("...")` and `require("...")` calls with a string literal argument.
 *
 * Non-literal arguments (template literals, variables) are skipped: there is no
 * specifier to match a pattern against.
 */
function collectCallExpressionImports(sourceFile: SourceFile, filePath: string): ImportInfo[] {
	const imports: ImportInfo[] = [];

	for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
		if (!isModuleLoadingCall(call)) {
			continue;
		}

		const [firstArgument] = call.getArguments();
		if (!firstArgument?.isKind(SyntaxKind.StringLiteral)) {
			continue;
		}

		const moduleSpecifier = firstArgument.getLiteralValue();
		const resolvedPath = resolveSpecifierInProject(sourceFile, filePath, moduleSpecifier);

		imports.push({
			sourceFile: filePath,
			moduleSpecifier,
			resolvedPath,
			isExternal: isExternalImport(moduleSpecifier, resolvedPath),
			line: call.getStartLineNumber(),
			column: call.getStart() - call.getStartLinePos(),
		});
	}

	return imports;
}

function isModuleLoadingCall(call: CallExpression): boolean {
	const expression = call.getExpression();

	// Dynamic import: the callee is the `import` keyword itself
	if (expression.isKind(SyntaxKind.ImportKeyword)) {
		return true;
	}

	// CommonJS require
	return expression.isKind(SyntaxKind.Identifier) && expression.getText() === "require";
}

/**
 * Resolve a relative specifier against the files already loaded into the project.
 *
 * ts-morph offers no `getModuleSpecifierSourceFile` for call expressions, so this
 * walks the usual TypeScript candidates. Alias and bare specifiers are left
 * unresolved; the evaluator matches those against the specifier itself (and the
 * tsconfig paths mapping).
 */
function resolveSpecifierInProject(
	sourceFile: SourceFile,
	filePath: string,
	moduleSpecifier: string,
): string | null {
	if (!moduleSpecifier.startsWith(".")) {
		return null;
	}

	const project = sourceFile.getProject();
	const base = path.resolve(path.dirname(filePath), moduleSpecifier);

	// A ".js" specifier in a TS project usually points at the ".ts" source
	const withoutJsExtension = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
	const extensions = ["", ".ts", ".tsx", ".d.ts"];

	const candidates = [
		...extensions.map((extension) => `${base}${extension}`),
		...extensions.map((extension) => `${withoutJsExtension}${extension}`),
		...["index.ts", "index.tsx"].map((indexFile) => path.join(base, indexFile)),
	];

	for (const candidate of candidates) {
		const resolved = project.getSourceFile(candidate);
		if (resolved) {
			return resolved.getFilePath();
		}
	}

	return null;
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
