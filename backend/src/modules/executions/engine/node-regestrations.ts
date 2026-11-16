import { NodeRegistry } from "./node.registry.js";
import { TriggerNodeHandler } from "./nodes/trigger.node.js";
import { HttpNodeHandler } from "./nodes/http.node.js";
import { TaskNodeHandler } from "./nodes/task.node.js";
import { ConditionNodeHandler } from "./nodes/condition.node.js";
import { EndNodeHandler } from "./nodes/end.node.js";

export const nodeRegistry = new NodeRegistry();

const triggerHandler = new TriggerNodeHandler();
const httpHandler = new HttpNodeHandler();
const taskHandler = new TaskNodeHandler();
const conditionHandler = new ConditionNodeHandler();
const endHandler = new EndNodeHandler();

nodeRegistry.register('trigger', triggerHandler);
nodeRegistry.register('start', triggerHandler);
nodeRegistry.register('http', httpHandler);
nodeRegistry.register('api', httpHandler);
nodeRegistry.register('task', taskHandler);
nodeRegistry.register('condition', conditionHandler);
nodeRegistry.register('end', endHandler);
nodeRegistry.register('terminal', endHandler);