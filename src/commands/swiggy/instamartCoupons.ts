import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../../structure/index.js";
import { getSwiggyAccessToken } from "../../utils/swiggyMcp.js";
import { classifySwiggyError } from "../../utils/swiggyErrors.js";
import { swiggyTools } from "../../utils/swiggyTools.js";
import { dataOf, escapeInline, escapeMarkdown, isRecord, text } from "../../utils/payload.js";
import { assertToolSuccess } from "../../utils/swiggyPayload.js";

const SWIGGY_ORANGE = 0xff5200;

export default new SlashCommand({
  data: new SlashCommandBuilder()
    .setName("instamart-coupons")
    .setDescription("Find and apply Swiggy Instamart coupons")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("find")
        .setDescription("Find coupons available for your Instamart cart")
        .addStringOption((option) =>
          option
            .setName("address-id")
            .setDescription("Delivery address ID from /instamart address")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("apply")
        .setDescription("Apply a coupon to your current Instamart cart")
        .addStringOption((option) =>
          option
            .setName("code")
            .setDescription("Coupon code from /instamart-coupons find")
            .setRequired(true)
        )
    ),
  category: "Swiggy",

  async execute(interaction: ChatInputCommandInteraction, client) {
    const accessToken = await getSwiggyAccessToken(client, interaction.user.id);
    if (!accessToken) {
      return interaction.reply("Use `/login` to connect your Swiggy account before using Instamart coupons.");
    }

    try {
      const subcommand = interaction.options.getSubcommand();
      await interaction.deferReply();

      if (subcommand === "find") {
        const addressId = interaction.options.getString("address-id", true).trim();
        const result = await swiggyTools.instamart.listCoupons(accessToken, { addressId });
        assertToolSuccess(result, "list_coupons");
        return interaction.editReply({ embeds: [buildCouponsEmbed(result, addressId)] });
      }

      if (subcommand === "apply") {
        const couponCode = interaction.options.getString("code", true).trim();
        const result = await swiggyTools.instamart.applyCoupon(accessToken, { couponCode });
        assertToolSuccess(result, "apply_coupon");
        return interaction.editReply({ embeds: [buildCouponAppliedEmbed(result, couponCode)] });
      }

      return interaction.editReply("Unknown coupon action.");
    } catch (error) {
      const message = `Instamart coupon action failed: ${classifySwiggyError(error).userFriendlyMessage}`;
      return interaction.deferred || interaction.replied ? interaction.editReply(message) : interaction.reply(message);
    }
  },
});

function buildCouponsEmbed(result: unknown, addressId: string): EmbedBuilder {
  const data = dataOf(result);
  const coupons = Array.isArray(data?.availableCoupons) ? data.availableCoupons : [];

  if (!coupons.length) {
    return new EmbedBuilder()
      .setColor(SWIGGY_ORANGE)
      .setAuthor({ name: "Swiggy Instamart" })
      .setTitle("🎟️ Instamart Coupons")
      .setDescription("No coupons are available for your current cart and address.")
      .setFooter({ text: `Address ${addressId}` })
      .setTimestamp();
  }

  const lines = coupons.slice(0, 15).map((coupon: any, index) => {
    const code = text(coupon, ["couponCode", "code"]) || "Unknown";
    const title = text(coupon, ["title", "name"]);
    const description = text(coupon, ["description", "details"]);
    const status = text(coupon, ["applicabilityStatus", "status"]) || "UNKNOWN";
    const statusEmoji = status === "APPLIED" ? "✅" : status === "APPLICABLE" ? "🟢" : "⚪";

    return [
      `### ${statusEmoji} ${escapeMarkdown(code)}`,
      title ? `**${escapeMarkdown(title)}**` : null,
      description ? escapeMarkdown(description).slice(0, 500) : null,
      `Status: **${escapeMarkdown(status)}**`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return new EmbedBuilder()
    .setColor(SWIGGY_ORANGE)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle("🎟️ Available Instamart Coupons")
    .setDescription(lines.join("\n\n").slice(0, 4000))
    .setFooter({ text: `${coupons.length} coupon(s) returned • Address ${addressId}` })
    .setTimestamp();
}

function buildCouponAppliedEmbed(result: unknown, couponCode: string): EmbedBuilder {
  const data = dataOf(result);
  const message = text(data, ["message"]);
  const billBreakdown = isRecord(data?.billBreakdown) ? data.billBreakdown : null;
  const discount = billBreakdown
    ? text(billBreakdown, ["discount", "couponDiscount", "discountAmount"])
    : null;
  const total = text(data, ["cartTotalAmount", "totalAmount", "total", "grandTotal", "payable"]);

  const details = [
    message ? escapeMarkdown(message) : "The coupon was applied successfully.",
    discount ? `**Discount:** ${escapeMarkdown(discount)}` : null,
    total ? `**Cart total:** ${escapeMarkdown(total)}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return new EmbedBuilder()
    .setColor(0x1da41a)
    .setAuthor({ name: "Swiggy Instamart" })
    .setTitle(`✅ Coupon Applied: ${escapeMarkdown(couponCode)}`)
    .setDescription(details.slice(0, 4000))
    .setFooter({ text: "The coupon is applied to your current cart" })
    .setTimestamp();
}
