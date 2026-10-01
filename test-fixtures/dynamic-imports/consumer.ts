export async function loadExternal() {
	const { getCloudflareContext } = await import("@opennextjs/cloudflare");
	return getCloudflareContext;
}

export async function loadLocal() {
	return import("./target.js");
}

export function loadCommonJs() {
	return require("node:fs");
}

export async function loadComputed(name: string) {
	// Not collectable: there is no literal specifier to match against
	return import(`./${name}.js`);
}
