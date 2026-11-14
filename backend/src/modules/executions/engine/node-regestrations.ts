import { NodeRegistry } from "./node.registry.js";
import { TriggerNodeHandler } from "./nodes/trigger.node.js";

export const nodeRegistry = new NodeRegistry();

nodeRegistry.register('trigger', new TriggerNodeHandler());