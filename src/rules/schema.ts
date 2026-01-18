import { z } from "zod";

const importRuleSchema = z.union([
	z.string().transform((from) => ({ from })),
	z.object({
		from: z.string(),
		message: z.string().optional(),
	}),
]);

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
	imports: z
		.object({
			allow: z.array(importRuleSchema).optional().default([]),
			deny: z.array(importRuleSchema).optional().default([]),
			mode: z.enum(["allow-first", "deny-first"]).optional().default("allow-first"),
		})
		.optional()
		.default({}),
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
