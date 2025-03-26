// src/trpc/service-client.ts
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { type AppRouter } from "~/server/api/root";
import SuperJSON from "superjson";
import { getBaseUrl } from "./react"; // Reuse the getBaseUrl function

// Configure the links similar to the React provider, but without streaming for simplicity
// unless background streaming is specifically needed later.
const links = [
    loggerLink({
        enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
    }),
    httpBatchLink({
        url: getBaseUrl() + "/api/trpc",
        transformer: SuperJSON,
        headers: () => {
            // Note: This client won't automatically have auth headers.
            // If needed, auth tokens would have to be managed and passed,
            // but tRPC context usually relies on cookies/headers from the browser request context,
            // which works fine when called from the browser environment even via this client.
            const headers = new Headers();
            headers.set("x-trpc-source", "service-client");
            return headers;
        },
    }),
];

/**
 * Dedicated tRPC client for use in services and background tasks.
 * Avoid using this directly in React components; use the `api` from `~/trpc/react` instead.
 */
export const serviceTrpcClient = createTRPCClient<AppRouter>({
    links,
});
