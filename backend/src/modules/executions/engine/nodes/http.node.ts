import { lookup } from "node:dns/promises";
import type { Workflow } from "../../../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HttpNodeConfig {
    method?: HttpMethod;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
    allowLocalNetwork?: boolean;
}

export class HttpNodeHandler implements NodeHandler {
    async execute(
        node: Workflow['nodes'][number],
        context: NodeExecutionContext
    ): Promise<NodeExecutionResult> {
        try {
            const config = (node.data?.config || node.data || {}) as HttpNodeConfig;

            if (!config.url || typeof config.url !== 'string') {
                throw new Error('HTTP node requires a valid URL.');
            }

            // 1. Variable Interpolation in URL
            const resolvedUrlStr = this.interpolate(config.url, context);
            const url = new URL(resolvedUrlStr);

            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Only HTTP and HTTPS protocols are permitted.');
            }

            // 2. SSRF Protection: Block localhost, private subnets, link-local, AWS metadata
            if (!config.allowLocalNetwork) {
                await this.validateSsrfSecurity(url.hostname);
            }

            const method: HttpMethod = config.method ?? 'GET';
            const allowedMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
            if (!allowedMethods.includes(method)) {
                throw new Error(`Unsupported HTTP method: ${method}`);
            }

            // 3. Prepare headers & body with interpolation
            const rawHeaders = config.headers ?? {};
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(rawHeaders)) {
                headers[k] = this.interpolate(String(v), context);
            }

            const timeoutMs = Number(config.timeout) || 10000;
            const requestOptions: RequestInit = {
                method,
                headers,
                signal: AbortSignal.timeout(timeoutMs)
            };

            // 4. Attach Body if applicable
            if (['POST', 'PUT', 'PATCH'].includes(method) && config.body !== undefined) {
                let interpolatedBody: unknown = config.body;
                if (typeof config.body === 'string') {
                    interpolatedBody = this.interpolate(config.body, context);
                } else if (typeof config.body === 'object' && config.body !== null) {
                    const jsonStr = JSON.stringify(config.body);
                    interpolatedBody = JSON.parse(this.interpolate(jsonStr, context));
                }

                requestOptions.body = typeof interpolatedBody === 'string'
                    ? interpolatedBody
                    : JSON.stringify(interpolatedBody);

                if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
                    (requestOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
                }
            }

            // 5. Execute Request
            const response = await fetch(url, requestOptions);
            const responseText = await response.text();

            let responseData: unknown = responseText;
            try {
                responseData = responseText ? JSON.parse(responseText) : null;
            } catch {
                // Keep as plain text
            }

            return {
                status: response.ok ? 'COMPLETED' : 'FAILED',
                output: {
                    statusCode: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    data: responseData
                },
                ...(!response.ok && {
                    error: `HTTP request failed with status ${response.status} ${response.statusText}`
                })
            };
        } catch (error) {
            return {
                status: 'FAILED',
                error: error instanceof Error ? error.message : 'HTTP request failed'
            };
        }
    }

    /**
     * Replaces {{variable}} placeholders with values from workflowInput or previous outputs.
     */
    private interpolate(template: string, context: NodeExecutionContext): string {
        return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
            const key = path.trim();
            const source = {
                workflowInput: context.workflowInput,
                ...context.workflowInput,
                ...context.previousNodeOutputs
            } as Record<string, unknown>;

            const val = this.resolvePath(source, key);
            return val !== undefined && val !== null ? String(val) : '';
        });
    }

    private resolvePath(obj: Record<string, unknown>, path: string): unknown {
        const parts = path.split('.');
        let current: unknown = obj;
        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return undefined;
            }
        }
        return current;
    }

    /**
     * SSRF Protection: Checks hostname against local, private, and metadata address ranges.
     */
    private async validateSsrfSecurity(hostname: string): Promise<void> {
        const lower = hostname.toLowerCase();

        // 1. Literal hostname checks
        if (
            lower === 'localhost' ||
            lower === '127.0.0.1' ||
            lower === '::1' ||
            lower === '0.0.0.0' ||
            lower === '169.254.169.254' ||
            lower.endsWith('.local') ||
            lower.endsWith('.internal')
        ) {
            throw new Error(`SSRF Blocked: Destination ${hostname} is a restricted local or metadata address.`);
        }

        // 2. Resolve DNS and inspect resolved IP
        try {
            const res = await lookup(hostname);
            const ip = res.address;

            if (this.isPrivateIp(ip)) {
                throw new Error(`SSRF Blocked: Hostname ${hostname} resolves to restricted private IP ${ip}.`);
            }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('SSRF Blocked')) {
                throw err;
            }
            // If DNS lookup fails, let fetch handle the resolution error
        }
    }

    private isPrivateIp(ip: string): boolean {
        // IPv4 loopback (127.0.0.0/8)
        if (/^127\./.test(ip)) return true;
        // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        if (/^10\./.test(ip)) return true;
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
        if (/^192\.168\./.test(ip)) return true;
        // Link-local / Cloud metadata: 169.254.0.0/16
        if (/^169\.254\./.test(ip)) return true;
        // Broadcast / Zero
        if (ip === '0.0.0.0' || ip === '255.255.255.255') return true;
        // IPv6 loopback / private
        if (ip === '::1' || ip === '::' || /^fe80:/i.test(ip) || /^fc00:/i.test(ip) || /^fd00:/i.test(ip)) return true;

        return false;
    }
}
