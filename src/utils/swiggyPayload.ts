/**
 * Swiggy-domain extraction helpers: given a raw MCP tool payload, locate and
 * de-duplicate the addresses / orders / items / products buried inside it.
 * These were previously duplicated between the instamart command and the modal
 * interaction handler. Pure data-shaping — no Discord/presentation concerns.
 */

import { compact, dataOf, firstArray, isRecord, JsonRecord, text } from "./payload.js";

/** Throws with the payload's error message when a tool reports `success: false`. */
export function assertToolSuccess(payload: unknown, toolName: string): void {
  if (isRecord(payload) && payload.success === false) {
    const error = isRecord(payload.error) ? payload.error.message : undefined;
    const message = (typeof error === "string" && error) || (typeof payload.message === "string" && payload.message) || `${toolName} failed.`;
    throw new Error(message);
  }
}

export function addressLooksLikeRecord(item: unknown): item is JsonRecord {
  return (
    isRecord(item) &&
    Boolean(
      text(item, [
        "fullAddress",
        "address",
        "displayAddress",
        "formattedAddress",
        "addressLine",
        "addressCategory",
        "category",
        "addressTag",
        "userName",
        "receiverPhone",
        "selectedAddress",
        "addressId",
        "id",
      ])
    )
  );
}

export function itemLooksLikeRecord(item: unknown): item is JsonRecord {
  return (
    isRecord(item) &&
    Boolean(
      text(item, [
        "displayName",
        "productName",
        "itemName",
        "name",
        "title",
        "spinId",
        "itemId",
        "productId",
        "skuId",
      ])
    )
  );
}

export function orderLooksLikeRecord(item: unknown): item is JsonRecord {
  return (
    isRecord(item) &&
    Boolean(
      text(item, [
        "orderId",
        "id",
        "order_id",
        "status",
        "orderStatus",
        "deliveryStatus",
        "items",
        "orderItems",
        "orderedItems",
      ])
    )
  );
}

export function fallbackAddressLine(address: unknown): string | null {
  const direct = text(address, ["fullAddress", "formattedAddress", "displayAddress", "address", "addressLine"]);
  if (direct || !isRecord(address)) return direct;

  const parts = [
    address.addressLine,
    address.addressLine2,
    address.flatNo,
    address.houseNo,
    address.building,
    address.landmark,
    address.locality,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.pincode,
  ]
    .map(compact)
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

export function getAddressId(address: unknown, data: unknown, addressCount: number): string | null {
  return (
    text(address, ["selectedAddress", "addressId", "id", "address_id"]) ||
    (addressCount === 1 ? text(data, ["selectedAddress", "addressId", "id"]) : null)
  );
}

export function extractAddresses(payload: unknown): JsonRecord[] {
  const data = dataOf(payload);
  const addresses = selectArray(data, ["addresses", "addressList", "savedAddresses", "data"], addressLooksLikeRecord);
  const seen = new Set<string>();

  return addresses.filter((address, index) => {
    const key = getAddressId(address, data, addresses.length) || `${fallbackAddressLine(address) || "address"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractInstamartAddressIds(payload: unknown): string[] {
  const data = dataOf(payload);
  const addresses = extractAddresses(payload);
  const ids = new Set<string>();

  for (const address of addresses) {
    const id = getAddressId(address, data, addresses.length);
    if (id) ids.add(id);
  }

  const selectedAddress = text(data, ["selectedAddress"]);
  if (selectedAddress) ids.add(selectedAddress);

  return [...ids];
}

export function extractInstamartOrders(payload: unknown): JsonRecord[] {
  const data = dataOf(payload);
  const orders = selectArray(data, ["orders", "orderHistory", "orderList", "data"], orderLooksLikeRecord);
  const seen = new Set<string>();

  return orders.filter((order, index) => {
    const key = text(order, ["orderId", "id", "order_id"]) || `${text(order, ["status", "orderStatus"]) || "order"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractMostOrderedItems(payload: unknown): JsonRecord[] {
  const data = dataOf(payload);
  const items = selectArray(data, ["items", "products", "goToItems", "yourGoToItems", "data"], itemLooksLikeRecord);
  const seen = new Set<string>();

  return items.filter((item, index) => {
    const key = text(item, ["spinId", "itemId", "productId", "skuId", "id"]) || `${text(item, ["name", "title"]) || "item"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractSearchProducts(payload: unknown): JsonRecord[] {
  const data = dataOf(payload);
  const products = selectArray(data, ["products", "items", "data"], itemLooksLikeRecord);
  const seen = new Set<string>();

  return products.filter((product, index) => {
    const key =
      text(product, ["productId", "parentProductId", "spinId", "itemId", "skuId", "id"]) ||
      `${text(product, ["displayName", "productName", "itemName", "name", "title"]) || "product"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Locates the array to parse. When a keyed array (or `data` itself) is present
 * it is filtered by `predicate`; otherwise we recurse into the payload with
 * {@link firstArray}, which returns the first array containing *any* match
 * (left unfiltered, preserving the original extraction behavior).
 */
function selectArray(data: unknown, keys: string[], predicate: (item: unknown) => item is JsonRecord): JsonRecord[] {
  const direct = firstDirectArray(data, keys);
  if (direct) return direct.filter(predicate);
  return firstArray(data, predicate) as JsonRecord[];
}

/** Returns the first of `keys` on `data` that is an array (or `data` itself if it is one). */
function firstDirectArray(data: unknown, keys: string[]): unknown[] | null {
  if (isRecord(data)) {
    for (const key of keys) {
      const value = data[key];
      if (Array.isArray(value)) return value;
    }
  }
  if (Array.isArray(data)) return data;
  return null;
}
