import { EmbedBuilder } from "discord.js";
import { swiggyTools } from "./swiggyTools.js";
import { compact, dataOf, deepNumber, deepText, firstArray, isRecord, number, text } from "./payload.js";

const DEFAULT_PAYMENT_METHOD = "COD";

export class StoreClosedError extends Error {
  constructor() {
    super("item inventory not available");
    this.name = "StoreClosedError";
  }
}

type InstamartCartItem = {
  spinId: string;
  quantity: number;
  name?: string;
  price?: number;
  inStock?: boolean;
};

function addressLine(address: any): string | null {
  const direct = text(address, ["addressLine", "formattedAddress", "displayAddress", "fullAddress", "address"]);
  if (direct || !isRecord(address)) return direct;

  const parts = [
    address.flatNo,
    address.houseNo,
    address.building,
    address.landmark,
    address.area,
    address.locality,
    address.city,
    address.state,
    address.pincode,
  ]
    .map(compact)
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function cartLines(value: any): any[] {
  if (!value || typeof value !== "object") return [];

  const quantity = number(value, ["quantity", "qty", "count", "itemQuantity"]);
  const spinId = deepText(value, ["spinId", "itemCode", "itemId", "skuId", "productId"]);
  return [
    ...(quantity > 0 && spinId ? [value] : []),
    ...Object.values(value).flatMap((child) => cartLines(child)),
  ];
}

function extractInstamartCartItems(cartPayload: any, cache: Map<string, string>): InstamartCartItem[] {
  const seen = new Set<string>();

  return cartLines(dataOf(cartPayload))
    .map((item) => {
      const spinId = deepText(item, ["spinId", "itemCode", "itemId", "skuId", "productId"]) || "";
      const name = deepText(item, ["displayName", "productName", "itemName", "skuName", "variantName", "name", "title"]);
      const inStock = isRecord(item) ? item.isInStockAndAvailable ?? item.inStock ?? item.available : undefined;

      if (name && name !== spinId) cache.set(spinId, name);

      return {
        spinId,
        quantity: number(item, ["quantity", "qty", "count", "itemQuantity"]),
        name: name && name !== spinId ? name : cache.get(spinId),
        price:
          number(item, ["discountedFinalPrice", "unitPrice", "totalPrice", "finalPrice", "sellingPrice", "price", "mrp"]) ||
          undefined,
        inStock: typeof inStock === "boolean" ? inStock : undefined,
      };
    })
    .filter((item) => {
      const key = `${item.spinId}:${item.quantity}`;
      if (!item.spinId || item.quantity <= 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Extracts Instamart cart items from a raw cart payload.
 * 
 * Parses cart data and returns an array of normalized items with extracted
 * spinId, quantity, name, price, and stock status. The cache parameter is used
 * to avoid recomputing name-to-spinId mappings across repeated calls.
 * 
 * @param cartPayload - The raw cart payload object from the Swiggy API
 * @param cache - Optional shared name/id mapping cache (defaults to new Map()).
 *                Used to store spinId-to-name mappings. Note: the cache is mutated
 *                if new name mappings are discovered during extraction.
 * @returns Array of InstamartCartItem objects with shape:
 *          { spinId: string; quantity: number; name?: string; price?: number; inStock?: boolean }
 *          Items are deduplicated by spinId:quantity pair.
 */
export function getExtractedInstamartCartItems(cartPayload: any, cache: Map<string, string> = new Map()): InstamartCartItem[] {
  return extractInstamartCartItems(cartPayload, cache);
}

export async function getInstamartCart(accessToken: string) {
  const result: any = await swiggyTools.instamart.getCart(accessToken);
  
  if (result?.success === true) return result;
  // Check if get_cart returns false with store closed related errors
  const errorMessage = result?.message || result?.error?.message || "";
  const isStoreClosedError = 
    typeof errorMessage === "string" && (
      errorMessage.toLowerCase().includes("item inventory not available") ||
      errorMessage.toLowerCase().includes("not serviceable")
    );

  if (result?.success === false && isStoreClosedError) {
    throw new StoreClosedError();
  }

  return result;
}

export async function clearInstamartCart(accessToken: string) {
  return swiggyTools.instamart.clearCart(accessToken);
}

export function buildInstamartCartEmbed(cartPayload: any, addressesPayload?: any): EmbedBuilder {
  const cache = new Map<string, string>();
  const data = dataOf(cartPayload);
  const items = extractInstamartCartItems(cartPayload, cache);
  const cartAddressId = deepText(data, ["selectedAddress", "selectedAddressId", "addressId", "id"]);
  const selectedAddressDetails = data?.selectedAddressDetails;
  const addresses = firstArray(dataOf(addressesPayload), (item) => isRecord(item) && Boolean(item.addressId || item.id));
  const matchedAddress = cartAddressId
    ? addresses.find((address) => address.addressId === cartAddressId || address.id === cartAddressId)
    : addresses[0];
  const address = selectedAddressDetails || matchedAddress || data;
  const addressParts = isRecord(address)
    ? [
        text(address, ["category"])
          ? `**Category**: \`${text(address, ["category"])?.replace(/`/g, "'")}\``
          : null,
        text(address, ["address"]) || addressLine(address) ? `**Address**: ${text(address, ["address"]) || addressLine(address)}` : null,
        text(address, ["phoneNumber", "mobile"])
          ? `**Phone**: \`${text(address, ["phoneNumber", "mobile"])?.replace(/`/g, "'")}\``
          : null,
      ].filter(Boolean)
    : [];
  const arrivalTime = text(data, ["sla"]) || text(selectedAddressDetails, ["sla"]) || deepText(data, ["sla"]);
  const directMethods = data?.availablePaymentMethods || data?.paymentMethods;
  const paymentLabels = (Array.isArray(directMethods)
    ? directMethods
    : firstArray(data, (item) => isRecord(item) && Boolean(item.method || item.paymentMethod))
  )
    .map((method) => (typeof method === "string" ? method : method.displayName || method.name || method.method || method.type))
    .filter(Boolean)
    .slice(0, 5);
  const total =
    text(data, ["cartTotalAmount"]) ||
    (deepNumber(data, ["total", "grandtotal", "payable"]) !== null ? `Rs ${deepNumber(data, ["total", "grandtotal", "payable"])}` : "Not returned");
  const breakdown = data?.billBreakdown;
  const billRows = isRecord(breakdown)
    ? [
        ...(Array.isArray(breakdown.lineItems)
          ? breakdown.lineItems
              .map((item: any) => {
                const label = text(item, ["label", "name"]);
                const value = text(item, ["value", "amount"]);
                return label && value ? `**${label.replace(/([\\*_~|`])/g, "\\$1")}**: \`${value.replace(/`/g, "'")}\`` : null;
              })
              .filter(Boolean)
          : []),
        isRecord(breakdown.toPay)
          ? `**${(text(breakdown.toPay, ["label"]) || "To Pay").replace(/([\\*_~|`])/g, "\\$1")}**: \`${(text(breakdown.toPay, ["value"]) || "Not returned").replace(/`/g, "'")}\``
          : null,
      ].filter(Boolean)
    : [];
  const swiggyOne = text(data?.superData, ["userStatus"]);
  const itemLines = items.length
    ? items.slice(0, 20).map((item, index) => {
        const unit = typeof item.price === "number" ? `Rs ${item.price}` : "Not returned";
        const totalPrice = (item.price || 0) * item.quantity;
        const stock = item.inStock === undefined ? "Not returned" : item.inStock ? "Yes" : "No";

        return [
          `**${`${index + 1}. ${item.name || "Item name not returned"}`.replace(/([\\*_~|`])/g, "\\$1")}**`,
          `\`Qty ${item.quantity}\` \`Unit ${unit}\` \`Total ${totalPrice ? `Rs ${totalPrice}` : "Not returned"}\` \`In Stock ${stock}\``,
        ].join("\n");
      })
    : ["Cart is empty."];

  return new EmbedBuilder()
    .setColor(0xff5200)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle("Instamart Cart Receipt")
    .setDescription(`**Items**\n${itemLines.join("\n\n").slice(0, 4000)}`)
    .addFields(
      { name: "Total", value: `\`${String(total).replace(/`/g, "'")}\``, inline: true },
      { name: "Payment", value: `\`${(paymentLabels.length ? paymentLabels.join(", ") : DEFAULT_PAYMENT_METHOD).replace(/`/g, "'")}\``.slice(0, 1024), inline: true },
      {
        name: "Swiggy One",
        value: `\`${!swiggyOne ? "Not returned" : swiggyOne === "WAS_SUPER" ? "Not a member" : swiggyOne.includes("SUPER") ? "Member" : swiggyOne}\``.slice(0, 1024),
        inline: true,
      },
      { name: "Arrival", value: `\`${(arrivalTime || "Not returned").replace(/`/g, "'")}\``, inline: true },
      { name: "Shipping Address", value: (addressParts.join("\n") || addressLine(address) || "Not returned").slice(0, 1024), inline: false },
      { name: "Bill Breakdown", value: (billRows.join("\n") || "Not returned").slice(0, 1024), inline: false }
    )
    .setTimestamp()
    .setFooter({ text: `${items.length} item(s) in cart` });
}
