// src/server/api/routers/llm.ts
import { createTRPCRouter } from "~/server/api/trpc";
// ... other imports remain if needed for other procedures ...

export const llmRouter = createTRPCRouter({
    // Add other non-streaming LLM procedures here if needed in the future
    // Example:
    // getModelInfo: publicProcedure.query(() => {
    //   return { modelName: MODEL_NAME };
    // }),
});
