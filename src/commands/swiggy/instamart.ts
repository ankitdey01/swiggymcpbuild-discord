import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../../structure/index.js";
import { getSwiggyAccessToken } from "../../utils/swiggyMcp.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import {
  buildInstamartCartEmbed,
  clearInstamartCart,
  getInstamartCart,
} from "../../utils/instamartCart.js";
import { swiggyTools } from "../../utils/swiggyTools.js";

const ADD_BUTTON_ID = "instamart-address-add";
const REMOVE_BUTTON_ID = "instamart-address-remove";

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

async function getInstamartAddresses(accessToken: string) {
  const result = await swiggyTools.instamart.getAddresses(accessToken);
  assertToolSuccess(result, "get_addresses");
  return result;
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
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("address").setDescription("Show and manage your saved Instamart addresses")
    ),
  category: "Swiggy",

  async execute(interaction, client) {
    await interaction.deferReply();

    const accessToken = getSwiggyAccessToken(client, interaction.user.id);
    if (!accessToken) {
      return interaction.editReply("Use `/login` to connect your Swiggy account before managing Instamart.");
    }

    try {
      const subcommandGroup = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === "cart" && subcommand === "show") {
        const cart = await getInstamartCart(accessToken);
        return interaction.editReply({ embeds: [buildInstamartCartEmbed(cart)] });
      }

      if (subcommandGroup === "cart" && subcommand === "clear") {
        await clearInstamartCart(accessToken);
        return interaction.editReply("Your Instamart cart has been cleared.");
      }

      if (subcommand === "address") {
        const addresses = await getInstamartAddresses(accessToken);
        return interaction.editReply({
          embeds: [buildInstamartAddressEmbed(addresses)],
          components: [buildInstamartAddressActions()],
        });
      }

      return interaction.editReply("Unknown Instamart action.");
    } catch (error) {
      const classified = classifySwiggyError(error);
      return interaction.editReply(`Instamart action failed: ${classified.userFriendlyMessage}`);
    }
  },
});