import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { paginate, SlashCommand } from "../../structure/index.js";
import { getSwiggyAccessToken, normalizeSwiggyOrderCount } from "../../utils/swiggyMcp.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import {
  buildInstamartCartEmbed,
  clearInstamartCart,
  getInstamartCart,
  getExtractedInstamartCartItems,
} from "../../utils/instamartCart.js";
import { callSwiggyCommerceTool, swiggyTools } from "../../utils/swiggyTools.js";

const ADD_BUTTON_ID = "instamart-address-add";
const REMOVE_BUTTON_ID = "instamart-address-remove";
const ITEMS_PER_PAGE = 5;

const dataOf = (payload: any) => payload?.data || payload?.result || payload;
const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function text(value: any, keys: string[]): string | null {
  if (!isRecord(value)) return null;

  for (const key of keys) {
    const child = value[key];
    if ((typeof child === "string" && child.trim()) || typeof child === "number") return String(child).trim();
  }

  return null;
}

function compact(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

function firstArray(value: any, predicate: (item: any) => boolean): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value) && value.some(predicate)) return value;

  for (const child of Object.values(value)) {
    const found = firstArray(child, predicate);
    if (found.length) return found;
  }

  return [];
}

function escapeInline(value: string): string {
  return value.replace(/`/g, "'");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\*_~|`])/g, "\\$1");
}

function assertToolSuccess(payload: any, toolName: string) {
  if (payload?.success === false) {
    const message = payload?.error?.message || payload?.message || `${toolName} failed.`;
    throw new Error(message);
  }
}

function addressLooksLikeRecord(item: any): boolean {
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

function itemLooksLikeRecord(item: any): boolean {
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

function orderLooksLikeRecord(item: any): boolean {
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

function fallbackAddressLine(address: any): string | null {
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

function getAddressId(address: any, data: any, addressCount: number): string | null {
  return (
    text(address, ["selectedAddress", "addressId", "id", "address_id"]) ||
    (addressCount === 1 ? text(data, ["selectedAddress", "addressId", "id"]) : null)
  );
}

function extractAddresses(payload: any): any[] {
  const data = dataOf(payload);
  const direct =
    (Array.isArray(data?.addresses) && data.addresses) ||
    (Array.isArray(data?.addressList) && data.addressList) ||
    (Array.isArray(data?.savedAddresses) && data.savedAddresses) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data);

  const addresses = Array.isArray(direct) ? direct.filter(addressLooksLikeRecord) : firstArray(data, addressLooksLikeRecord);
  const seen = new Set<string>();

  return addresses.filter((address, index) => {
    const key = getAddressId(address, data, addresses.length) || `${fallbackAddressLine(address) || "address"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractInstamartOrders(payload: any): any[] {
  const data = dataOf(payload);
  const direct =
    (Array.isArray(data?.orders) && data.orders) ||
    (Array.isArray(data?.orderHistory) && data.orderHistory) ||
    (Array.isArray(data?.orderList) && data.orderList) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data);

  const orders = Array.isArray(direct) ? direct.filter(orderLooksLikeRecord) : firstArray(data, orderLooksLikeRecord);
  const seen = new Set<string>();

  return orders.filter((order, index) => {
    const key = text(order, ["orderId", "id", "order_id"]) || `${text(order, ["status", "orderStatus"]) || "order"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMostOrderedItems(payload: any): any[] {
  const data = dataOf(payload);
  const direct =
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.products) && data.products) ||
    (Array.isArray(data?.goToItems) && data.goToItems) ||
    (Array.isArray(data?.yourGoToItems) && data.yourGoToItems) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data);

  const items = Array.isArray(direct) ? direct.filter(itemLooksLikeRecord) : firstArray(data, itemLooksLikeRecord);
  const seen = new Set<string>();

  return items.filter((item, index) => {
    const key =
      text(item, ["spinId", "itemId", "productId", "skuId", "id"]) ||
      `${text(item, ["name", "title"]) || "item"}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSearchProducts(payload: any): any[] {
  const data = dataOf(payload);
  const direct =
    (Array.isArray(data?.products) && data.products) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data);

  const products = Array.isArray(direct) ? direct.filter(itemLooksLikeRecord) : firstArray(data, itemLooksLikeRecord);
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

async function getInstamartAddresses(accessToken: string) {
  const result = await swiggyTools.instamart.getAddresses(accessToken);
  assertToolSuccess(result, "get_addresses");
  return result;
}

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

function buildInstamartHistoryEmbeds(orders: any[], shownCount: number): EmbedBuilder[] {
  if (!orders.length) {
    return [
      new EmbedBuilder()
        .setColor(0xff5200)
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
        .setColor(0xff5200)
        .setAuthor({ name: "Swiggy Instamart" })
        .setTitle("Instamart Order History")
        .setDescription(pageOrders.map((order, offset) => formatOrderLine(order, start + offset)).join("\n\n").slice(0, 4000))
        .setFooter({ text: `Page ${pageNumber}/${pageCount} | Showing ${visibleOrders.length}/${shownCount} order(s)` })
        .setTimestamp()
    );
  }

  return pages;
}

function formatMostOrderedItemLine(item: any, index: number): string {
  const name = text(item, ["displayName", "productName", "itemName", "name", "title"]) || "Unnamed item";
  const brand = text(item, ["brand", "brandName"]) || "Unknown brand";

  // Get info from first variation
  const variation = Array.isArray(item.variations) && item.variations[0];
  const quantity = variation?.quantityDescription || "Unknown quantity";
  const mrp = variation?.price?.mrp;
  const offerPrice = variation?.price?.offerPrice;
  const spinId = variation?.spinId;
  const inStock = variation?.isInStockAndAvailable ?? item.inStock ?? true;

  // Format price with discount if applicable
  let priceStr = "Unknown";
  if (mrp && offerPrice) {
    if (mrp === offerPrice) {
      priceStr = `Rs ${offerPrice}`;
    } else {
      priceStr = `Rs ${offerPrice} (MRP: Rs ${mrp})`;
    }
  } else if (mrp) {
    priceStr = `Rs ${mrp}`;
  }

  return [
    `**${index + 1}. ${escapeMarkdown(name).slice(0, 180)} | ${inStock ? "Available 🟢" : "Out of stock 🔴"}**`,
    `Brand: ${escapeMarkdown(brand).slice(0, 100)}`,
    `Quantity: ${quantity}`,
    `Price: ${priceStr}`,
    spinId ? `\`ID ${escapeInline(spinId)}\`` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildMostOrderedEmbeds(items: any[], addressId: string): EmbedBuilder[] {
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

function buildInstamartSearchEmbeds(
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
        .setColor(0xff5200)
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
      .setColor(0xff5200)
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

function buildInstamartAddressEmbed(addressPayload: any): EmbedBuilder {
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
    .setColor(0xff5200)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle("Saved Instamart Addresses")
    .setDescription(lines.join("\n\n").slice(0, 4000))
    
    .setFooter({ text: `${addresses.length} address(es) returned` })
    .setTimestamp();
}

function buildInstamartAddressActions() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ADD_BUTTON_ID).setLabel("Add").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(REMOVE_BUTTON_ID).setLabel("Remove").setStyle(ButtonStyle.Danger)
  );
}

function buildProductAddedEmbed(productItem: any, quantity: number, addressId: string): EmbedBuilder {
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



export default new SlashCommand({
  data: new SlashCommandBuilder()
    .setName("instamart")
    .setDescription("Manage Swiggy Instamart")
    .addSubcommandGroup((group) =>
      group
        .setName("cart")
        .setDescription("Manage your Instamart cart")
        .addSubcommand((subcommand) =>
          subcommand.setName("show").setDescription("Show your current Instamart cart")
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("clear").setDescription("Clear your Instamart cart")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add a product to your Instamart cart")
            .addStringOption((option) =>
              option
                .setName("address-id")
                .setDescription("Address ID from /instamart address")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("product-id")
                .setDescription("Product ID to add")
                .setRequired(true)
            )
            .addIntegerOption((option) =>
              option
                .setName("quantity")
                .setDescription("Quantity to add (default: 1)")
                .setMinValue(1)
                .setMaxValue(100)
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("address").setDescription("Show and manage your saved Instamart addresses")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("history")
        .setDescription("Show your recent Instamart order history")
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription("Number of orders to fetch, max 20")
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addBooleanOption((option) =>
          option
            .setName("active-only")
            .setDescription("Show only active or ongoing orders")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("most-ordered")
        .setDescription("Show your most ordered Instamart items for a saved address")
        .addStringOption((option) =>
          option
            .setName("address-id")
            .setDescription("Address ID from /instamart address")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("Search Instamart products for a saved address")
        .addStringOption((option) =>
          option
            .setName("address-id")
            .setDescription("Address ID from /instamart address")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("product")
            .setDescription("Product name, category, or brand to search")
            .setRequired(true)
        )
    ),
  category: "Swiggy",

  async execute(interaction, client) {
    const accessToken = getSwiggyAccessToken(client, interaction.user.id);
    if (!accessToken) {
      return interaction.reply("Use `/login` to connect your Swiggy account before managing Instamart.");
    }

    try {
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "show" || subcommand === "clear" || subcommand === "add") {
        await interaction.deferReply();

        switch (subcommandGroup) {
          case "cart":
            if (subcommand === "show") {
              const cart = await getInstamartCart(accessToken);
              return interaction.editReply({ embeds: [buildInstamartCartEmbed(cart)] });
            }
            if (subcommand === "clear") {
              await clearInstamartCart(accessToken);
              return interaction.editReply("Your Instamart cart has been cleared.");
            }
            if (subcommand === "add") {
              const addressId = interaction.options.getString("address-id", true).trim();
              const spinId = interaction.options.getString("product-id", true).trim();
              const quantity = interaction.options.getInteger("quantity") ?? 1;

              // Get current cart
              const currentCart = await getInstamartCart(accessToken);
              const cache = new Map<string, string>();
              const currentItems = getExtractedInstamartCartItems(currentCart, cache);

              // Find if item already exists
              const existingItemIndex = currentItems.findIndex((item) => item.spinId === spinId);
              
              // Build new items array
              let newItems: any[];
              if (existingItemIndex >= 0) {
                // Update quantity of existing item (immutably)
                const updatedItems = currentItems.map((item, index) =>
                  index === existingItemIndex
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
                );
                newItems = updatedItems.map((item) => ({
                  spinId: item.spinId,
                  quantity: item.quantity,
                }));
              } else {
                // Add new item
                newItems = [
                  ...currentItems.map((item) => ({
                    spinId: item.spinId,
                    quantity: item.quantity,
                  })),
                  {
                    spinId,
                    quantity,
                  },
                ];
              }

              // Update cart
              const updateResult = await swiggyTools.instamart.updateCart(accessToken, {
                selectedAddressId: addressId,
                items: newItems,
              });
              assertToolSuccess(updateResult, "update_cart");

              // Get updated cart to show product details
              const updatedCart = await getInstamartCart(accessToken);
              const cache2 = new Map<string, string>();
              const updatedItems = getExtractedInstamartCartItems(updatedCart, cache2);
              const addedItem = updatedItems.find((item) => item.spinId === spinId);

              // Build product added embed
              if (addedItem) {
                return interaction.editReply({
                  embeds: [buildProductAddedEmbed(addedItem, quantity, addressId)],
                });
              } else {
                return interaction.editReply(`Product with ID \`${escapeInline(spinId)}\` has been added to your cart.`);
              }
            }
            break;
          default:
            return interaction.editReply(`Unknown subcommand group: ${subcommandGroup || 'none'}`);
        }
      }

      else if (subcommand === "address") {
        await interaction.deferReply();

        const addresses = await getInstamartAddresses(accessToken);
        return interaction.editReply({
          embeds: [buildInstamartAddressEmbed(addresses)],
          components: [buildInstamartAddressActions()],
        });
      }

      else if (subcommand === "history") {
        await interaction.deferReply();

        const count = normalizeSwiggyOrderCount(interaction.options.getInteger("count"), 20, 20);
        const activeOnly = interaction.options.getBoolean("active-only") ?? false;
        const result = await swiggyTools.instamart.getOrders(accessToken, {
          count,
          orderType: "INSTAMART",
          activeOnly,
        });
        assertToolSuccess(result, "get_orders");

        const orders = extractInstamartOrders(result).slice(0, 20);
        const embeds = buildInstamartHistoryEmbeds(orders, count);
        return paginate(
          {
            ...interaction,
            user: interaction.user,
            deferReply: async () => undefined,
            editReply: interaction.editReply.bind(interaction),
          } as any,
          embeds
        );
      }

      else if (subcommand === "most-ordered") {
        await interaction.deferReply();

        const addressId = interaction.options.getString("address-id", true).trim();
        const result = await swiggyTools.instamart.yourGoToItems(accessToken, { addressId });
        assertToolSuccess(result, "your_go_to_items");

        const items = extractMostOrderedItems(result);
        const embeds = buildMostOrderedEmbeds(items, addressId);
        return paginate(
          {
            ...interaction,
            user: interaction.user,
            deferReply: async () => undefined,
            editReply: interaction.editReply.bind(interaction),
          } as any,
          embeds
        );
      }

      else if (subcommand === "search") {
        await interaction.deferReply();

        const addressId = interaction.options.getString("address-id", true).trim();
        const product = interaction.options.getString("product", true).trim();
        const result = await callSwiggyCommerceTool(accessToken, "instamart", "search_products", {
          addressId,
          query: product,
        });
        assertToolSuccess(result, "search_products");

        const products = extractSearchProducts(result);
        const nextOffset = text(dataOf(result), ["nextOffset"]);
        const embeds = buildInstamartSearchEmbeds(products, addressId, product, nextOffset || undefined);
        return paginate(
          {
            ...interaction,
            user: interaction.user,
            deferReply: async () => undefined,
            editReply: interaction.editReply.bind(interaction),
          } as any,
          embeds
        );
      }

      return interaction.reply("Unknown Instamart action.");
    } catch (error) {
      const classified = classifySwiggyError(error);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(`Instamart action failed: ${classified.userFriendlyMessage}`);
      }

      return interaction.reply(`Instamart action failed: ${classified.userFriendlyMessage}`);
    }
  },
});
