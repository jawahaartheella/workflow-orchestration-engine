import type { Workflow } from "../../../workflows/workflow.model.js";
import type { NodeExecutionContext, NodeExecutionResult, NodeHandler } from "../node.types.js";

type HttpMethod = 'GET' | 'POST' | 'PUT' |'PATCH' |'DELETE';

// Configuration stored in the workflow node's data property
interface HttpNodeConfig {
    method?: HttpMethod,
    url?: string,
    headers?: Record<string, string>,
    body?: unknown
}

export class HttpNodeHandler implements NodeHandler {
  async execute(
    node: Workflow['nodes'][number],
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {

    try {
      const config = node.data as HttpNodeConfig;

      // 1. Validate configuration
      if (!config.url || typeof config.url !== 'string') {
        throw new Error('HTTP node requires a valid URL.');
      }

      const method = config.method ?? 'GET';

      const allowedMethods: HttpMethod[] = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE'
      ];

      if (!allowedMethods.includes(method)) {
        throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // 2. Validate URL
      const url = new URL(config.url);

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are supported.');
      }

      // 3. Prepare request options
      const headers = config.headers ?? {};

      const requestOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(10000)
      };

      // 4. Attach body for methods that support it
      if (
        ['POST', 'PUT', 'PATCH'].includes(method) &&
        config.body !== undefined
      ) {
        requestOptions.body = JSON.stringify(config.body);

        if (!Object.keys(headers).some(
          key => key.toLowerCase() === 'content-type'
        )) {
          requestOptions.headers = {
            ...headers,
            'Content-Type': 'application/json'
          };
        }
      }

      // 5. Execute HTTP request
      const response = await fetch(url, requestOptions);

      // 6. Read response
      const responseText = await response.text();

      let responseData: unknown = responseText;

      try {
        responseData = responseText
          ? JSON.parse(responseText)
          : null;
      } catch {
        // Keep the response as plain text if it isn't JSON.
      }

      // 7. Return execution result
      return {
        status: response.ok ? 'COMPLETED' : 'FAILED',
        output: {
          statusCode: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData
        },
        ...(!response.ok && {
            error: `HTTP request failed with status ${response.status}`
        })  
      };

    } catch (error) {
      return {
        status: 'FAILED',
        error: error instanceof Error
          ? error.message
          : 'HTTP request failed.'
      };
    }
  }
}