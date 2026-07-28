/**
 * Presentation layer for the /instamart command: builds every Discord embed and
 * the address action row from already-extracted payload data. Kept separate
 * from the command (dispatch/error handling) and from swiggyPayload (extraction)
 * so each file has a single responsibility.
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { dataOf, escapeInline, escapeMarkdown, text } from "./payload.js";
import { extractAddresses, fallbackAddressLine, getAddressId } from "./swiggyPayload.js";
import { ADD_BUTTON_ID, REMOVE_BUTTON_ID } from "./instamartConstants.js";

const ITEMS_PER_PAGE = 5;
const SWIGGY_ORANGE = 0xff5200;

function formatPrice(item: any): string | null {
  const value = text(item, ["price", "finalPrice", "sellingPrice", "mrp", "defaultPrice"]);
  if (!value) return null;
  return value.startsWith("Rs") ? value : `Rs ${value}`;
}

function formatOrderItems(order: any): string | null {
  const items =
    (Array.isArray(order?.items) && order.items) ||
    (Array.isArray(order?.orderItems) && order.orderItems) ||
    (Array.isArray(order?.orderedItems) && order.orderedItems) ||
    [];

  if (!items.length) return null;

  return items
    .slice(0, 4)
    .map((item: any) => {
      if (typeof item === "string") return escapeMarkdown(item);

      const name = text(item, ["name", "itemName", "productName", "displayName", "title"]) || "Item";
      const quantity = text(item, ["quantity", "qty", "count", "packSize"]);
      return quantity ? `${escapeMarkdown(name)} x ${escapeInline(quantity)}` : escapeMarkdown(name);
    })
    .join(", ");
}

function formatOrderDate(order: any): string | null {
  const raw = text(order, ["orderTime", "createdAt", "orderedAt", "orderDate", "date", "created_time"]);
  if (!raw) return null;

  const timestamp = Number(raw);
  const date = Number.isFinite(timestamp) && raw.length >= 10
    ? new Date(raw.length === 10 ? timestamp * 1000 : timestamp)
    : new Date(raw);

  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatOrderLine(order: any, index: number): string {
  const orderId = text(order, ["orderId", "id", "order_id"]) || "Unknown";
  const status = text(order, ["status", "orderStatus", "deliveryStatus", "historyStatus"]) || "Unknown";
  const total = text(order, ["totalAmount", "total", "amount", "orderTotal", "billTotal", "grandTotal"]);
  const date = formatOrderDate(order);
  const items = formatOrderItems(order);
  
  const statusEmoji = status.toUpperCase().includes("DELIVERED") ? "✅" : 
                      status.toUpperCase().includes("CANCELLED") ? "❌" : 
                      "🔄";

  return [
    `### ${statusEmoji} Order #${escapeMarkdown(orderId)}`,
    `**${escapeMarkdown(status)}** • ${total ? formatPrice({ price: total }) : 'N/A'}`,
    date ? `📅 ${date}` : null,
    items ? `📦 ${items}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstamartHistoryEmbeds(orders: any[], shownCount: number): EmbedBuilder[] {
  if (!orders.length) {
    return [
      new EmbedBuilder()
        .setColor(SWIGGY_ORANGE)
        .setAuthor({ name: "Swiggy Instamart", iconURL: "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto/portal/m/app_icon" })
        .setTitle("📦 Order History")
        .setDescription("No orders found in your history.")
        .setFooter({ text: `Requested ${shownCount} order(s)` })
        .setTimestamp(),
    ];
  }

  const visibleOrders = orders.slice(0, 20);
  const pages: EmbedBuilder[] = [];

  for (let start = 0; start < visibleOrders.length; start += ITEMS_PER_PAGE) {
    const pageOrders = visibleOrders.slice(start, start + ITEMS_PER_PAGE);
    const pageNumber = pages.length + 1;
    const pageCount = Math.ceil(visibleOrders.length / ITEMS_PER_PAGE);

    pages.push(
      new EmbedBuilder()
        .setColor(SWIGGY_ORANGE)
        .setAuthor({ name: "Swiggy Instamart", iconURL: "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto/portal/m/app_icon" })
        .setTitle("📦 Your Order History")
        .setDescription(pageOrders.map((order, offset) => formatOrderLine(order, start + offset)).join("\n\n").slice(0, 4000))
        .addFields({
          name: "💡 Tip",
          value: `Use \`/instamart order-details\` with an order ID to see full details`,
          inline: false
        })
        .setFooter({ text: `Page ${pageNumber}/${pageCount} • ${visibleOrders.length} of ${shownCount} orders` })
        .setTimestamp()
    );
  }

  return pages;
}

export function buildMostOrderedEmbeds(items: any[], addressId: string): EmbedBuilder[] {
  return buildInstamartSearchEmbeds(items, addressId, "most ordered items", undefined, "Most Ordered Items");
}

function rupee(value: any): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = String(value).trim();
  return raw ? `Rs ${raw}` : null;
}

function productImageUrl(product: any): string | null {
  const direct = text(product, ["imageUrl", "image", "imageId", "image_url"]);
  if (direct?.startsWith("http")) return direct;

  const variations = Array.isArray(product?.variations) ? product.variations : [];
  for (const variation of variations) {
    const imageUrl = text(variation, ["imageUrl", "image", "imageId", "image_url"]);
    if (imageUrl?.startsWith("http")) return imageUrl;
  }

  return null;
}

function formatVariationLine(variation: any, index: number): string {
  const spinId = text(variation, ["spinId", "id", "skuId", "itemId"]) || "Not returned";
  const quantity = text(variation, ["quantityDescription", "quantity", "packSize", "size"]) || "Not returned";
  const discountedPrice = rupee(variation?.price?.offerPrice ?? variation?.discountedPrice ?? variation?.offerPrice);
  const mrp = rupee(variation?.price?.mrp ?? variation?.mrp);
  const inStock = variation?.isInStockAndAvailable ?? variation?.inStock ?? variation?.isAvail;
  const priceLine =
    discountedPrice && mrp && discountedPrice !== mrp
      ? `Discounted Price: ${discountedPrice} | MRP: ${mrp}`
      : `Discounted Price: ${discountedPrice || mrp || "Not returned"}`;

  return [
    `**Variant ${index + 1}: ${escapeMarkdown(quantity).slice(0, 80)}**`,
    `Product ID: \`${escapeInline(spinId)}\``,
    priceLine,
    typeof inStock === "boolean" ? `Available: ${inStock ? "Yes" : "No"}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstamartSearchEmbeds(
  products: any[],
  addressId: string,
  productQuery: string,
  nextOffset?: string,
  emptyTitle = "Product Search"
): EmbedBuilder[] {
  if (!products.length) {
    const description =
      emptyTitle === "Most Ordered Items"
        ? `No go-to items were returned for address \`${escapeInline(addressId)}\`.`
        : `No products were returned for \`${escapeInline(productQuery)}\` at address \`${escapeInline(addressId)}\`.`;

    return [
      new EmbedBuilder()
        .setColor(SWIGGY_ORANGE)
        .setAuthor({ name: "Swiggy Instamart" })
        .setTitle(emptyTitle)
        .setDescription(description)
        .setTimestamp(),
    ];
  }

  const pageCount = products.length;

  return products.map((product, index) => {
    const name = text(product, ["displayName", "productName", "itemName", "name", "title"]) || "Unnamed product";
    const brand = text(product, ["brand", "brandName"]) || "Not returned";
    const inStock = product?.inStock ?? product?.isAvail;
    const promoted = product?.isPromoted;
    const variations = Array.isArray(product?.variations) ? product.variations : [];
    const description = [
      `Brand: ${escapeMarkdown(brand).slice(0, 120)}`,
      typeof inStock === "boolean" ? `Available: ${inStock ? "Yes" : "No"}` : null,
      typeof promoted === "boolean" ? `Featured/Sponsored: ${promoted ? "Yes" : "No"}` : null,
      variations.length ? `\n${variations.map(formatVariationLine).join("\n\n")}` : "\nNo variants were returned.",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000);

    const embed = new EmbedBuilder()
      .setColor(SWIGGY_ORANGE)
      .setAuthor({ name: "Swiggy Instamart" })
      .setTitle(escapeMarkdown(name).slice(0, 250))
      .setDescription(description)
      .setFooter({
        text: `Page ${index + 1}/${pageCount} | ${products.length} product(s) | Address ${addressId}${
          nextOffset ? ` | Next offset ${nextOffset}` : ""
        }`,
      })
      .setTimestamp();

    const imageUrl = productImageUrl(product);
    if (imageUrl) embed.setImage(imageUrl);

    return embed;
  });
}

export function buildInstamartAddressEmbed(addressPayload: unknown): EmbedBuilder {
  const data = dataOf(addressPayload);
  const addresses = extractAddresses(addressPayload);

  const lines = addresses.length
    ? addresses.slice(0, 12).map((address, index) => {
        const addressId = getAddressId(address, data, addresses.length) || "Not returned";
        const fullAddress = fallbackAddressLine(address) || "Not returned";
        const category = text(address, ["addressCategory", "category", "type"]) || "Not returned";
        const tag = text(address, ["addressTag", "tag", "name"]) || "Not returned";
        const userName = text(address, ["userName", "name", "contactName"]) || "Not returned";
        const receiverPhone = text(address, ["receiverPhone", "phoneNumber", "mobile", "phone"]) || "Not returned";

        return [
          `**${index + 1}. ${escapeMarkdown(fullAddress).slice(0, 220)}**`,
          `\`ID ${escapeInline(addressId)}\` \`Category ${escapeInline(category)}\` \`Tag ${escapeInline(tag)}\``,
          `\`User ${escapeInline(userName)}\` \`Receiver ${escapeInline(receiverPhone)}\``,
        ].join("\n");
      })
    : ["No saved addresses were returned. Use **Add** to create one."];

  return new EmbedBuilder()
    .setColor(SWIGGY_ORANGE)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle("Saved Instamart Addresses")
    .setDescription(lines.join("\n\n").slice(0, 4000))
    .setFooter({ text: `${addresses.length} address(es) returned` })
    .setTimestamp();
}

export function buildInstamartAddressActions(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ADD_BUTTON_ID).setLabel("Add").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(REMOVE_BUTTON_ID).setLabel("Remove").setStyle(ButtonStyle.Danger)
  );
}

export function buildProductAddedEmbed(productItem: any, quantity: number, addressId: string): EmbedBuilder {
  const name = text(productItem, ["displayName", "productName", "itemName", "name", "title"]) || "Unknown Product";
  const price = rupee(productItem?.price?.offerPrice ?? productItem?.discountedPrice ?? productItem?.offerPrice ?? productItem?.price);
  const mrp = rupee(productItem?.price?.mrp ?? productItem?.mrp);
  const spinId = text(productItem, ["spinId", "id", "skuId", "itemId"]);
  const inStock = productItem?.isInStockAndAvailable ?? productItem?.inStock ?? true;

  const description = [
    `**Product ID**: \`${escapeInline(spinId || "Not provided")}\``,
    price ? `**Price**: ${price}` : null,
    mrp && price !== mrp ? `**MRP**: ${mrp}` : null,
    `**Quantity**: ${quantity}`,
    `**Status**: ${inStock ? "✅ Available" : "❌ Out of Stock"}`,
    `**Address**: \`${escapeInline(addressId)}\``,
  ]
    .filter(Boolean)
    .join("\n");

  return new EmbedBuilder()
    .setColor(0x1da41a)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle(`✅ ${escapeMarkdown(name)}`)
    .setDescription(description)
    .setFooter({ text: "Product added to cart" })
    .setTimestamp();
}

export function buildInstamartOrderDetailsEmbed(result: unknown): EmbedBuilder {
  const data = dataOf(result);
  const order = data;

  const orderId = text(order, ["orderId", "id", "order_id"]) || "Not returned";
  const status = text(order, ["status", "orderStatus", "deliveryStatus", "historyStatus", "currentStatus"]) || "Unknown";
  const orderDate = formatOrderDate(order);
  
  const items =
    (Array.isArray(order?.items) && order.items) ||
    (Array.isArray(order?.orderItems) && order.orderItems) ||
    (Array.isArray(order?.orderedItems) && order.orderedItems) ||
    [];

  const itemsText = items.length
    ? items
        .slice(0, 15)
        .map((item: any) => {
          const name = text(item, ["name", "itemName", "productName", "displayName", "title"]) || "Item";
          const quantity = text(item, ["quantity", "qty", "count"]);
          const price = formatPrice(item);
          return `• ${escapeMarkdown(name)}${quantity ? ` x ${quantity}` : ""}${price ? ` - ${price}` : ""}`;
        })
        .join("\n")
    : "No items returned";

  const billDetails = order?.billDetails || order;
  const itemTotal = formatPrice({ price: text(billDetails, ["itemTotal", "subtotal", "subTotal", "itemsTotal"]) });
  const deliveryFee = formatPrice({ price: text(billDetails, ["deliveryFee", "deliveryCharge", "deliveryCharges"]) });
  const handlingFee = formatPrice({ price: text(billDetails, ["handlingFee", "packagingFee", "packingCharge", "packingCharges"]) });
  const grandTotal = formatPrice({ price: text(billDetails, ["grandTotal", "total", "totalAmount", "orderTotal"]) });

  const billBreakdown = [
    itemTotal ? `**Item Total**: ${itemTotal}` : null,
    deliveryFee ? `**Delivery Fee**: ${deliveryFee}` : null,
    handlingFee ? `**Handling Fee**: ${handlingFee}` : null,
    grandTotal ? `**Grand Total**: ${grandTotal}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const addressObj = order?.deliveryAddress;
  const addressLine = typeof addressObj === "object" && addressObj !== null
    ? text(addressObj, ["addressLine", "address", "fullAddress"])
    : text(order, ["address", "deliveryAddress"]);

  const description = [
    `**Order ID**: \`${escapeInline(orderId)}\``,
    `**Status**: \`${escapeInline(status)}\``,
    orderDate ? `**Date**: ${orderDate}` : null,
    addressLine ? `**Address**: ${escapeMarkdown(addressLine).slice(0, 200)}` : null,
    `\n**Items** (${items.length}):\n${itemsText}`,
    billBreakdown ? `\n**Bill Breakdown**:\n${billBreakdown}` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  return new EmbedBuilder()
    .setColor(SWIGGY_ORANGE)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle(`Order Details - ${orderId}`)
    .setDescription(description)
    .setTimestamp();
}

export function buildCheckoutEmbed(result: unknown, paymentChoice: string): EmbedBuilder {
  const data = dataOf(result);
  const orderId = text(data, ["orderId", "id", "order_id", "orderNumber"]) || "Not returned";
  const status = text(data, ["status", "orderStatus", "state"]) || "Placed";
  const total = formatPrice({ price: text(data, ["cartTotal", "total", "grandTotal", "totalAmount", "orderTotal", "amount"]) }) || "Not returned";
  const deliveryAddress = text(data, ["deliveryAddress", "address"]);
  const deliveryLabel = text(data, ["deliveryLabel", "addressLabel"]);
  
  const embed = new EmbedBuilder()
    .setColor(0x1da41a)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle("✅ Order Placed Successfully")
    .setDescription([
      `**Order ID**: \`${escapeInline(orderId)}\``,
      `**Status**: ${escapeMarkdown(status)}`,
      `**Total**: ${total}`,
      `**Payment Method**: ${paymentChoice === "COD" ? "Cash on Delivery" : "UPI QR Code"}`,
      deliveryLabel ? `\n**${escapeMarkdown(deliveryLabel)}**` : null,
      deliveryAddress ? escapeMarkdown(deliveryAddress).slice(0, 200) : null,
    ].filter(Boolean).join("\n"))
    .setTimestamp();

  return embed;
}

export function buildTrackOrderEmbed(result: unknown): EmbedBuilder {
  const data = dataOf(result);
  
  const orderId = text(data, ["orderId", "id", "order_id"]) || "Not returned";
  
  // Status information
  const statusObj = data?.status || {};
  const statusMessage = text(statusObj, ["statusMessage", "message", "status"]) || "Unknown";
  
  // Check if status is unavailable
  if (statusMessage.toLowerCase().includes("order status unavailable")) {
    return new EmbedBuilder()
      .setColor(0xff9800)
      .setAuthor({ name: "Swiggy Instamart" })
      .setTitle(`📦 Track Order - ${orderId}`)
      .setDescription("**Order status unavailable. Please re-check given Order ID**")
      .setTimestamp();
  }
  
  const orderTitle = text(data, ["orderTitle", "title"]) || "Instamart Order";
  const orderSubtitle = text(data, ["orderSubtitle", "subtitle"]);
  
  // Store information
  const storeInfo = data?.storeInfo || {};
  const storeName = text(storeInfo, ["name", "storeName"]) || "Store";
  const storeAddress = text(storeInfo, ["address", "storeAddress"]);
  
  // Delivery information
  const deliveryInfo = data?.deliveryInfo || {};
  const addressLabel = text(deliveryInfo, ["addressLabel", "label"]);
  const fullAddress = text(deliveryInfo, ["fullAddress", "address", "deliveryAddress"]);
  
  // Items
  const items = Array.isArray(data?.items) ? data.items : [];
  const itemCount = data?.itemCount || items.length;
  
  const itemsText = items.length
    ? items
        .slice(0, 10)
        .map((item: any) => {
          const name = text(item, ["name", "itemName", "productName"]) || "Item";
          const quantity = text(item, ["quantity", "qty"]);
          const price = text(item, ["price", "amount"]);
          return `• ${escapeMarkdown(name)}${price ? ` - ${price}` : ""}`;
        })
        .join("\n")
    : "No items information available";
  
  // Time information
  const placedAt = text(data, ["placedAt", "orderTime", "createdAt"]);
  const pollingInterval = data?.pollingIntervalSeconds;
  
  const description = [
    `**Order**: ${escapeMarkdown(orderTitle)}`,
    orderSubtitle ? `**Details**: ${escapeMarkdown(orderSubtitle)}` : null,
    `**Status**: ${escapeMarkdown(statusMessage)}`,
    placedAt ? `**Placed At**: ${escapeMarkdown(placedAt)}` : null,
    `\n**Store**: ${escapeMarkdown(storeName)}`,
    storeAddress ? `${escapeMarkdown(storeAddress).slice(0, 200)}` : null,
    addressLabel ? `\n**${escapeMarkdown(addressLabel)}**` : null,
    fullAddress ? `${escapeMarkdown(fullAddress).slice(0, 200)}` : null,
    `\n**Items** (${itemCount}):\n${itemsText}`,
    pollingInterval && pollingInterval > 0 ? `\n*Tracking updates every ${pollingInterval} seconds*` : null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  return new EmbedBuilder()
    .setColor(SWIGGY_ORANGE)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle(`📦 Track Order - ${orderId}`)
    .setDescription(description)
    .setTimestamp();
}
