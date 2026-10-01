export interface NovelGateway {
	find(id: string): Promise<string>;
}

export const gateway: NovelGateway = {
	find: async (id) => id,
};
