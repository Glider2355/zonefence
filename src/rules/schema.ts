import { z } from "zod";

const importRuleSchema = z.union([
	z.string().transform((from) => ({ from })),
	z.object({
		from: z.string(),
		message: z.string().optional(),
	}),
]);

const importsSchema = z.object({
	allow: z.array(importRuleSchema).optional().default([]),
	deny: z.array(importRuleSchema).optional().default([]),
	mode: z.enum(["allow-first", "deny-first"]).optional().default("allow-first"),
});

const patternRuleConfigSchema = z.object({
	description: z.string().optional(),
	imports: importsSchema.optional(),
	mergeStrategy: z.enum(["merge", "override"]).optional().default("merge"),
});

const directoryPatternRuleSchema = z.object({
	pattern: z.string(),
	config: patternRuleConfigSchema,
	priority: z.number().int().optional().default(0),
});

export const zoneFenceConfigSchema = z.object({
	version: z.number().int().positive(),
	description: z.string().optional(),
	scope: z
		.object({
			apply: z.enum(["self", "descendants"]).optional().default("descendants"),
			exclude: z.array(z.string()).optional().default([]),
		})
		.optional()
		.default({}),
	imports: importsSchema.optional().default({}),
	directoryPatterns: z.array(directoryPatternRuleSchema).optional().default([]),
});

export type ParsedZoneFenceConfig = z.infer<typeof zoneFenceConfigSchema>;

export function parseConfig(data: unknown): ParsedZoneFenceConfig {
	return zoneFenceConfigSchema.parse(data);
}

export function validateConfig(
	data: unknown,
): { success: true; data: ParsedZoneFenceConfig } | { success: false; error: z.ZodError } {
	const result = zoneFenceConfigSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}
