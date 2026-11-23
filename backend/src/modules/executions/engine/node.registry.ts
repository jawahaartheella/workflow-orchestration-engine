import type { NodeHandler } from "./node.types.js";

export class NodeRegistry {
    private handlers = new Map<string, NodeHandler>();

    // Register a handler for a particular node type
    register(type: string, handler: NodeHandler): void {
        if(this.handlers.has(type)) {
            throw new Error(`Handler already registered for node types ${type}`);
        }

        this.handlers.set(type, handler);
    }

    // Retrieve the handler from a node type
    get(type: string): NodeHandler {
        const handler = this.handlers.get(type);

        if(!handler) {
            throw new Error(`No handler registered for node type: ${type}`);
        }

        return handler
    }

    // Check whether a node type has a registered handler
    has(type: string): boolean {
        return this.handlers.has(type)
    }

    // Get all registered node types
    getRegisteredTypes(): string[] {
        return Array.from(this.handlers.keys());
    }
}