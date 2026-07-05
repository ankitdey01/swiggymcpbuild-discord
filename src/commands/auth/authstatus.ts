import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { SlashCommand } from "../../structure/index.js";
import { authNotConfiguredEmbed, formatExpiryDetailed } from "../../utils/authEmbeds.js";

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("authstatus")
        .setDescription("Check your Swiggy authentication status"),
    category: "Auth",
    async execute(interaction, client) {
        // Check if Swiggy auth is initialized
        if (!client.swiggyAuth) {
            return interaction.reply({
                embeds: [authNotConfiguredEmbed()],
                flags: MessageFlags.Ephemeral
            });
        }

        const isAuthenticated = client.swiggyAuth.isAuthenticated(interaction.user.id);

        if (!isAuthenticated) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Yellow")
                        .setTitle("🔓 Not Authenticated")
                        .setDescription("You're not currently logged in to Swiggy.")
                        .addFields({
                            name: "Next Steps",
                            value: "Run `/login` to connect your Swiggy account.",
                            inline: false
                        })
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        const expiry = client.swiggyAuth.getTokenExpiry(interaction.user.id);
        if (!expiry) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("❌ Error")
                        .setDescription("Unable to retrieve token expiry information."),
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Green")
                    .setTitle("🔐 Authenticated")
                    .setDescription(`You're successfully logged in to Swiggy.`)
                    .addFields({
                        name: "Token Status",
                        value: "✓ Valid and active",
                        inline: false
                    })
                    .addFields({
                        name: "Expires In",
                        value: formatExpiryDetailed(expiry),
                        inline: false
                    })
                    .addFields({
                        name: "Available Scopes",
                        value: "• `mcp:tools` - Access Swiggy tools\n• `mcp:resources` - Read resources\n• `mcp:prompts` - Use prompts",
                        inline: false
                    })
                    .addFields({
                        name: "Want to logout?",
                        value: "Run `/logout` to disconnect your account.",
                        inline: false
                    })
                    .setFooter({ text: "Token will auto-refresh when needed" })
            ],
            flags: MessageFlags.Ephemeral
        });
    }
});
