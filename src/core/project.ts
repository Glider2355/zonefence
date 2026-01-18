import { Project } from "ts-morph";
import type { ProjectOptions } from "./types.js";

export function createProject(options: ProjectOptions): Project {
	const project = new Project({
		tsConfigFilePath: options.tsConfigFilePath,
		skipAddingFilesFromTsConfig: true,
	});

	project.addSourceFilesAtPaths([
		`${options.rootDir}/**/*.ts`,
		`${options.rootDir}/**/*.tsx`,
		`!${options.rootDir}/**/node_modules/**`,
		`!${options.rootDir}/**/dist/**`,
	]);

	return project;
}

export function checkProject(options: ProjectOptions): Project {
	return createProject(options);
}
