import { NodeRegistry } from "./node.registry.js";
import { TriggerNodeHandler } from "./nodes/trigger.node.js";
import { HttpNodeHandler } from "./nodes/http.node.js";

export const nodeRegistry = new NodeRegistry();

nodeRegistry.register('trigger', new TriggerNodeHandler());
nodeRegistry.register('http', new HttpNodeHandler());