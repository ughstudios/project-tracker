/**
 * Vercel serverless request bodies are capped (~4.5 MB including multipart overhead).
 * Shared constant for multipart routes and upload limits (no Node built-ins).
 */
export const VERCEL_SERVER_MULTIPART_BUDGET_BYTES = 4 * 1024 * 1024;
