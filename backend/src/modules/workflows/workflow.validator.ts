import type { Workflow } from "./workflow.model.js";

export function validateWorkflowDefinition(
    workflow: Pick<Workflow, 'nodes' | 'edges'>
): string[] {
    const errors: string[] = [];

    const nodes = workflow.nodes ?? [];
    const edges = workflow.edges ?? [];

    // 1.Workflow must contain atleats one node.
    if(nodes.length === 0) {
        errors.push('Workflow must contain atleat one node');
    }

    // 2. Check for unique node IDs
    const nodeIds = new Set<string>();

    for(const node of nodes) {
        if(!node.id || typeof node.id !== 'string') {
            errors.push('Every node must have a valid ID');
            continue;
        }

        if(nodeIds.has(node.id)) {
            errors.push(`Duplicate node Id: ${node.id}`);
        }

        nodeIds.add(node.id);

        // 3. Validate node type
        if(!node.type || typeof node.type !== 'string') {
            errors.push(`Node ${node.id} must have a valid type`);
        }

        // 4. Validate node positon
        if(!node.position || 
            !Number.isFinite(node.position.x) || 
            !Number.isFinite(node.position.y)
        ) {
            errors.push(`Node ${node.id} has invalid position`);
        }
    }

    // 5. Atleast one trigger must exist
    const hasTrigger = nodes.some(node => node.type === 'trigger');

    if(!hasTrigger) {
        errors.push('Workflow must contain atleast one trigger');
    }

    // 6. Validate Edges
    const edgeIds = new Set<string>();
    const connections = new Set<string>();

    for(const edge of edges) {
        if(!edge.id || typeof edge.id !== 'string') {
            errors.push('Every edge must have valid ID');
            continue;
        }

        if(edgeIds.has(edge.id)) {
            errors.push(`Duplicate edge Id ${edge.id}`);
        }

        edgeIds.add(edge.id);

        if(!nodeIds.has(edge.source)) {
            errors.push(`Edge ${edge.id} references an unknown source node.`);
        }

        if(!nodeIds.has(edge.target)) {
            errors.push(`Edge ${edge.id} references an unknown target node.`);
        }

        if(edge.source === edge.target) {
            errors.push(`Edge ${edge.id} cannot cnonnect a node to itself.`);
        }

        // 7. Prevent duplicate connections
        const connectionKey = `${edge.source}->${edge.target}`;

        if(connections.has(connectionKey)) {
            errors.push(`Duplicate connection: ${connectionKey}`);
        }

        connections.add(connectionKey);
    }

    return errors;
}