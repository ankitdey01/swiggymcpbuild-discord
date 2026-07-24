import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { paginate, SlashCommand } from "../../structure/index.js";
import { getSwiggyAccessToken, normalizeSwiggyOrderCount } from "../../utils/swiggyMcp.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import {
  buildInstamartCartEmbed,
  clearInstamartCart,
  getInstamartCart,
  getExtractedInstamartCartItems,
  StoreClosedError,
} from "../../utils/instamartCart.js";
import { swiggyTools } from "../../utils/swiggyTools.js";
import { dataOf, escapeInline, isRecord, text } from "../../utils/payload.js";
import {
  assertToolSuccess,
  extractInstamartOrders,
  extractMostOrderedItems,
  extractSearchProducts,
} from "../../utils/swiggyPayload.js";
import {
  buildInstamartAddressActions,
  buildInstamartAddressEmbed,
  buildInstamartHistoryEmbeds,
  buildInstamartSearchEmbeds,
  buildMostOrderedEmbeds,
  buildProductAddedEmbed,
} from "../../utils/instamartEmbeds.js";

type CartItemInput = { spinId: string; quantity: number };

async function getInstamartAddresses(accessToken: string) {
  const result = await swiggyTools.instamart.getAddresses(accessToken);
  assertToolSuccess(result, "get_addresses");
  return result;
}

/** Reduces extracted cart items to the minimal `{ spinId, quantity }` shape update_cart expects. */
function toCartInputs(items: { spinId: string; quantity: number }[]): CartItemInput[] {
  return items.map(({ spinId, quantity }) => ({ spinId, quantity }));
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
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "show") {
        await interaction.deferReply();
        const cart = await getInstamartCart(accessToken);
        return interaction.editReply({ embeds: [buildInstamartCartEmbed(cart)] });
      }

      if (subcommand === "clear") {
        await interaction.deferReply();
        await clearInstamartCart(accessToken);
        return interaction.editReply("Your Instamart cart has been cleared.");
      }

      if (subcommand === "add") {
        await interaction.deferReply();
        return addToCart(interaction, accessToken);
      }

      if (subcommand === "address") {
        await interaction.deferReply();
        const addresses = await getInstamartAddresses(accessToken);
        return interaction.editReply({
          embeds: [buildInstamartAddressEmbed(addresses)],
          components: [buildInstamartAddressActions()],
        });
      }

      if (subcommand === "history") {
        await interaction.deferReply();
        const count = normalizeSwiggyOrderCount(interaction.options.getInteger("count"));
        const activeOnly = interaction.options.getBoolean("active-only") ?? false;
        const result = await swiggyTools.instamart.getOrders(accessToken, { count, orderType: "INSTAMART", activeOnly });
        assertToolSuccess(result, "get_orders");

        const orders = extractInstamartOrders(result).slice(0, 20);
        return paginate(interaction, buildInstamartHistoryEmbeds(orders, count));
      }

      if (subcommand === "most-ordered") {
        await interaction.deferReply();
        const addressId = interaction.options.getString("address-id", true).trim();
        const result = await swiggyTools.instamart.yourGoToItems(accessToken, { addressId });
        assertToolSuccess(result, "your_go_to_items");

        const items = extractMostOrderedItems(result);
        return paginate(interaction, buildMostOrderedEmbeds(items, addressId));
      }

      if (subcommand === "search") {
        await interaction.deferReply();
        const addressId = interaction.options.getString("address-id", true).trim();
        const product = interaction.options.getString("product", true).trim();
        const result = await swiggyTools.instamart.searchProducts(accessToken, { addressId, query: product });
        assertToolSuccess(result, "search_products");

        const products = extractSearchProducts(result);
        const nextOffset = text(dataOf(result), ["nextOffset"]);
        return paginate(interaction, buildInstamartSearchEmbeds(products, addressId, product, nextOffset || undefined));
      }

      return interaction.reply("Unknown Instamart action.");
    } catch (error) {
      return handleInstamartError(interaction, error);
    }
  },
});

/**
 * Adds (or increments) a product in the cart. Reads the current cart, merges the
 * requested item, and calls update_cart. If Swiggy reports the quantity is only
 * partially available, the cart is reverted to its original items.
 */
async function addToCart(
  interaction: ChatInputCommandInteraction,
  accessToken: string
): Promise<unknown> {
  const addressId = interaction.options.getString("address-id", true).trim();
  const spinId = interaction.options.getString("product-id", true).trim();
  const quantity = interaction.options.getInteger("quantity") ?? 1;

  const currentItems = getExtractedInstamartCartItems(await getInstamartCart(accessToken));
  const originalItems = toCartInputs(currentItems);

  const existingIndex = currentItems.findIndex((item) => item.spinId === spinId);
  const newItems: CartItemInput[] =
    existingIndex >= 0
      ? originalItems.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
        )
      : [...originalItems, { spinId, quantity }];

  const updateResult = await swiggyTools.instamart.updateCart(accessToken, {
    selectedAddressId: addressId,
    items: newItems,
  });

  if (isPartiallyAvailableError(updateResult)) {
    // Roll the cart back to how it was before this add.
    await swiggyTools.instamart.updateCart(accessToken, { selectedAddressId: addressId, items: originalItems });

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff9800)
          .setAuthor({ name: "Swiggy Instamart" })
          .setTitle("⚠️ Item Quantity Partially Available")
          .setDescription("Item quantity is partially available, please reduce Quantity.")
          .setTimestamp(),
      ],
    });
  }

  assertToolSuccess(updateResult, "update_cart");

  const addedItem = getExtractedInstamartCartItems(await getInstamartCart(accessToken)).find((item) => item.spinId === spinId);
  if (addedItem) {
    return interaction.editReply({ embeds: [buildProductAddedEmbed(addedItem, quantity, addressId)] });
  }

  return interaction.editReply(`Product with ID \`${escapeInline(spinId)}\` has been added to your cart.`);
}

function isPartiallyAvailableError(result: unknown): boolean {
  if (!isRecord(result) || result.success !== false) return false;
  const message = isRecord(result.error) ? result.error.message : undefined;
  return typeof message === "string" && message.toLowerCase().includes("partially available");
}

async function handleInstamartError(
  interaction: ChatInputCommandInteraction,
  error: unknown
): Promise<unknown> {
  if (error instanceof StoreClosedError) {
    const embed = new EmbedBuilder()
      .setColor("Red")
      .setAuthor({ name: "Swiggy Instamart" })
      .setTitle("🔴 Store Closed")
      .setDescription("The store is currently closed. Item inventory is not available at your selected location.")
      .setThumbnail("attachment://closed.png")
      .setTimestamp();

    const payload = { embeds: [embed], files: ["./src/public/closed.png"] };
    return interaction.deferred || interaction.replied ? interaction.editReply(payload) : interaction.reply(payload);
  }

  const message = `Instamart action failed: ${classifySwiggyError(error).userFriendlyMessage}`;
  return interaction.deferred || interaction.replied ? interaction.editReply(message) : interaction.reply(message);
}
