import type { NovelGateway } from "./port.js";
import type { NovelGateway as InlineTypeOnly } from "./port.js";
import type { NovelGateway as Mixed, gateway } from "./port.js";
import type * as port from "./port.js";
import "./port.js";

export type { NovelGateway as ReExportedType } from "./port.js";
export type { NovelGateway as InlineReExportedType } from "./port.js";
export { gateway as reExportedValue } from "./port.js";
export * from "./port.js";

export type Used = [NovelGateway, InlineTypeOnly, Mixed, typeof gateway, typeof port];
