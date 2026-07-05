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
  const orderId = text(order, ["orderId", "id", "order_id"]) || "Not returned";
  const status = text(order, ["status", "orderStatus", "deliveryStatus"]) || "Status not returned";
  const total = text(order, ["total", "totalAmount", "amount", "orderTotal", "billTotal"]);
  const date = formatOrderDate(order);
  const items = formatOrderItems(order);
  const address = text(order, ["address", "deliveryAddress", "addressName", "area", "locality"]);
  const tags = [status, total ? formatPrice({ price: total }) : null, date].filter(Boolean).map((value) => `\`${escapeInline(value!)}\``);

  return [
    `**${index + 1}. Order ${escapeMarkdown(orderId)}**`,
    tags.length ? tags.join(" ") : null,
    items ? items.slice(0, 500) : null,
    address ? `_${escapeMarkdown(address).slice(0, 180)}_` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInstamartHistoryEmbeds(orders: any[], shownCount: number): EmbedBuilder[] {
  if (!orders.length) {
    return [
      new EmbedBuilder()
        .setColor(SWIGGY_ORANGE)
        .setAuthor({ name: "Swiggy Instamart" })
        .setTitle("Instamart Order History")
        .setDescription("No Instamart orders were returned.")
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
        .setAuthor({ name: "Swiggy Instamart" })
        .setTitle("Instamart Order History")
        .setDescription(pageOrders.map((order, offset) => formatOrderLine(order, start + offset)).join("\n\n").slice(0, 4000))
        .setFooter({ text: `Page ${pageNumber}/${pageCount} | Showing ${visibleOrders.length}/${shownCount} order(s)` })
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
