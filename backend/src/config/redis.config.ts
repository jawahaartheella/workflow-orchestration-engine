import type { ConnectionOptions } from "bullmq";

export function getRedisConnectionOptions(): ConnectionOptions {
    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = Number(process.env.REDIS_PORT) || 6379;

    const options: ConnectionOptions = {
        host,
        port,
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    };

    if (process.env.REDIS_PASSWORD) {
        options.password = process.env.REDIS_PASSWORD;
    }

    return options;
}

export function getRedisHost(): string {
    return process.env.REDIS_HOST || '127.0.0.1';
}

export function getRedisPort(): number {
    return Number(process.env.REDIS_PORT) || 6379;
}
