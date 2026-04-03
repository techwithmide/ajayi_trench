export type HealthServer = {
    readonly port: number;
    close: () => Promise<void>;
};
/**
 * Tiny HTTP listener for load balancers / uptime checks.
 * Set HEALTH_PORT=0 to disable.
 */
export declare function startHealthServer(): HealthServer | null;
//# sourceMappingURL=health-server.d.ts.map