import { callSwiggyTool } from "./swiggyMcp.js";

export type SwiggyCommerceServer = "instamart";

type InstamartToolName =
  | "checkout"
  | "clear_cart"
  | "create_address"
  | "delete_address"
  | "get_addresses"
  | "get_cart"
  | "get_order_details"
  | "get_orders"
  | "report_error"
  | "search_products"
  | "track_order"
  | "update_cart"
  | "your_go_to_items";

export type SwiggyToolArguments = Record<string, unknown>;
export type GetInstamartOrdersArguments = {
  count?: number;
  orderType?: string;
  activeOnly?: boolean;
};
export type YourGoToItemsArguments = {
  addressId: string;
};

type SwiggyToolNameByServer = {
  instamart: InstamartToolName;
};

const DOCS_BASE = "https://mcp.swiggy.com/builders/docs/reference";
const instamartToolRows = [
  ["get_addresses", "Discover", "read-only", "Get saved delivery addresses for the authenticated Swiggy user."],
  ["create_address", "Discover", "mutating", "Create a delivery address for the authenticated user."],
  ["delete_address", "Discover", "mutating", "Delete a saved delivery address."],
  ["search_products", "Discover", "read-only", "Search Instamart products available at a selected address."],
  ["your_go_to_items", "Discover", "read-only", "Fetch frequently or recently ordered Instamart items."],
  ["get_cart", "Cart", "read-only", "Get the current Instamart cart with bill breakdown."],
  ["update_cart", "Cart", "mutating", "Replace the Instamart cart with the provided items."],
  ["clear_cart", "Cart", "mutating", "Clear all items from the Instamart cart."],
  ["checkout", "Order", "mutating", "Place and confirm an Instamart grocery order."],
  ["get_orders", "Track", "read-only", "Fetch Instamart order history."],
  ["get_order_details", "Track", "read-only", "Get details for a specific Instamart order."],
  ["track_order", "Track", "read-only", "Track an Instamart order in real time."],
  ["report_error", "Support", "mutating", "Generate an error report for the Swiggy MCP team."],
] as const;

const SWIGGY_TOOL_REGISTRY = {
  instamart: instamartToolRows.map(([name, stage, behavior, description]) => ({
    server: "instamart",
    name,
    stage,
    behavior,
    description,
    docsUrl: `${DOCS_BASE}/instamart/${name}.md`,
  })),
} as const;

type SwiggyToolDefinitionFor<S extends SwiggyCommerceServer> = (typeof SWIGGY_TOOL_REGISTRY)[S][number];

export function getSwiggyTools<S extends SwiggyCommerceServer>(server: S): readonly SwiggyToolDefinitionFor<S>[] {
  return SWIGGY_TOOL_REGISTRY[server] as readonly SwiggyToolDefinitionFor<S>[];
}

export function getSwiggyToolDefinition<S extends SwiggyCommerceServer>(
  server: S,
  name: string
): SwiggyToolDefinitionFor<S> | undefined {
  return getSwiggyTools(server).find((tool) => tool.name === name);
}

export function isSwiggyToolName<S extends SwiggyCommerceServer>(
  server: S,
  name: string
): name is SwiggyToolNameByServer[S] {
  return Boolean(getSwiggyToolDefinition(server, name));
}

export async function callSwiggyCommerceTool<S extends SwiggyCommerceServer>(
  accessToken: string,
  server: S,
  name: SwiggyToolNameByServer[S],
  args: SwiggyToolArguments = {}
) {
  return callSwiggyTool(server, accessToken, name, args);
}

export const swiggyTools = {
  instamart: {
    clearCart: (accessToken: string, args: SwiggyToolArguments = {}) =>
      callSwiggyTool("instamart", accessToken, "clear_cart", args),
    createAddress: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "create_address", args),
    deleteAddress: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "delete_address", args),
    getAddresses: (accessToken: string) => callSwiggyTool("instamart", accessToken, "get_addresses"),
    getCart: (accessToken: string) => callSwiggyTool("instamart", accessToken, "get_cart"),
    getOrders: (accessToken: string, args: GetInstamartOrdersArguments = {}) =>
      callSwiggyTool("instamart", accessToken, "get_orders", args),
    updateCart: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "update_cart", args),
    yourGoToItems: (accessToken: string, args: YourGoToItemsArguments) =>
      callSwiggyTool("instamart", accessToken, "your_go_to_items", args),
  },
} as const;
