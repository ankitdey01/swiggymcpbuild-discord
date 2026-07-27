import { callSwiggyTool } from "./swiggyMcp.js";

export type SwiggyToolArguments = Record<string, unknown>;

export type GetInstamartOrdersArguments = {
  count?: number;
  orderType?: string;
  activeOnly?: boolean;
};

export type YourGoToItemsArguments = {
  addressId: string;
};

export type SearchProductsArguments = {
  addressId: string;
  query: string;
};

export type CheckoutArguments = {
  addressId: string;
  paymentMethod: string;
};

export type TrackOrderArguments = {
  orderId: string;
  lat?: number;
  lng?: number;
};

export type GetOrderDetailsArguments = {
  orderId: string;
};

/**
 * Thin, typed facade over the Instamart MCP tools. Each method maps a friendly
 * name to its underlying `snake_case` tool and forwards the bearer token.
 */
export const swiggyTools = {
  instamart: {
    checkout: (accessToken: string, args: CheckoutArguments) =>
      callSwiggyTool("instamart", accessToken, "checkout", args),
    clearCart: (accessToken: string, args: SwiggyToolArguments = {}) =>
      callSwiggyTool("instamart", accessToken, "clear_cart", args),
    createAddress: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "create_address", args),
    deleteAddress: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "delete_address", args),
    getAddresses: (accessToken: string) => callSwiggyTool("instamart", accessToken, "get_addresses"),
    getCart: (accessToken: string) => callSwiggyTool("instamart", accessToken, "get_cart"),
    getOrderDetails: (accessToken: string, args: GetOrderDetailsArguments) =>
      callSwiggyTool("instamart", accessToken, "get_order_details", args),
    getOrders: (accessToken: string, args: GetInstamartOrdersArguments = {}) =>
      callSwiggyTool("instamart", accessToken, "get_orders", args),
    searchProducts: (accessToken: string, args: SearchProductsArguments) =>
      callSwiggyTool("instamart", accessToken, "search_products", args),
    trackOrder: (accessToken: string, args: TrackOrderArguments) =>
      callSwiggyTool("instamart", accessToken, "track_order", args),
    updateCart: (accessToken: string, args: SwiggyToolArguments) =>
      callSwiggyTool("instamart", accessToken, "update_cart", args),
    yourGoToItems: (accessToken: string, args: YourGoToItemsArguments) =>
      callSwiggyTool("instamart", accessToken, "your_go_to_items", args),
  },
} as const;
