import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CustomClient } from "../structure/index.js";

export type SwiggyMcpServer = "instamart";

export interface McpToolContentItem {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface McpToolResult {
  structuredContent?: unknown;
  content?: McpToolContentItem[];
  toolResult?: unknown;
  [key: string]: unknown;
}

const SWIGGY_MCP_BASE_URL = "https://mcp.swiggy.com";
const SWIGGY_MCP_ENDPOINTS: Record<SwiggyMcpServer, string> = {
  instamart: "im",
};
const SWIGGY_MCP_TIMEOUT_MS = parseInt(process.env.SWIGGY_MCP_TIMEOUT_MS || "30000", 10);

export function getSwiggyAccessToken(client: CustomClient, userId: string): string | null {
  return client.swiggyAuth?.getAccessToken(userId) || null;
}

export async function withSwiggyMcpClient<T>(
  server: SwiggyMcpServer,
  accessToken: string,
  callback: (client: MCPClient) => Promise<T>,
  clientName = "swiggy-discord-bot"
): Promise<T> {
  const endpoint = SWIGGY_MCP_ENDPOINTS[server];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SWIGGY_MCP_TIMEOUT_MS);

  const transport = new StreamableHTTPClientTransport(new URL(`${SWIGGY_MCP_BASE_URL}/${endpoint}`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    },
  });

  const client = new MCPClient({
    name: clientName,
    version: "1.0.0",
  });

  try {
    await client.connect(transport);
    return await callback(client);
  } finally {
    clearTimeout(timeoutId);
    await client.close().catch(() => undefined);
  }
}

export async function callSwiggyTool(
  server: SwiggyMcpServer,
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {}
) {
  const toolArguments = sanitizeSwiggyToolArguments(args);
  const result = await withSwiggyMcpClient(
    server,
    accessToken,
    (client) =>
      client.callTool({
        name,
        arguments: toolArguments,
      }),
    `swiggy-${server}-discord-bot`
  );

  const output = unwrapMcpToolData(result);
  console.log(
    `[Swiggy MCP] ${server}.${name}`,
    JSON.stringify(
      {
        arguments: toolArguments,
        output,
      },
      null,
      2
    )
  );

  return output;
}

export function sanitizeSwiggyToolArguments(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined && value !== null));
}

export function normalizeSwiggyOrderCount(count: number | null | undefined, fallback = 20, max = 20): number {
  const safeCount = Number.isFinite(count) && count ? Math.trunc(count) : fallback;
  return Math.max(1, Math.min(max, safeCount));
}

export function unwrapMcpToolData(result: McpToolResult): unknown {
  if (result?.structuredContent) return result.structuredContent;

  const text = result?.content?.find((item: McpToolContentItem) => item.type === "text")?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  return result;
}
