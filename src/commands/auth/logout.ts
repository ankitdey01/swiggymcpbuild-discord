import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { SlashCommand } from "../../structure/index.js";
import { authNotConfiguredEmbed } from "../../utils/authEmbeds.js";

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("logout")
        .setDescription("Disconnect your Swiggy account from the Discord bot"),
    category: "Auth",
    async execute(interaction, client) {
        // Check if Swiggy auth is initialized
        if (!client.swiggyAuth) {
            return interaction.reply({
                embeds: [authNotConfiguredEmbed()],
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is authenticated
        if (!client.swiggyAuth.isAuthenticated(interaction.user.id)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Yellow")
                        .setTitle("⚠️ Not Authenticated")
                        .setDescription("You're not currently logged in to Swiggy.")
                        .addFields({
                            name: "Want to login?",
                            value: "Use `/login` to authenticate with your Swiggy account.",
                            inline: false
                        })
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Logout and revoke token
            await client.swiggyAuth.logout(interaction.user.id);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Green")
                        .setTitle("✓ Logged Out")
                        .setDescription("Your Swiggy account has been disconnected from the Discord bot.")
                        .addFields({
                            name: "What happens now?",
                            value: "Your access token has been revoked. You can login again anytime with `/login`.",
                            inline: false
                        })
                ],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            const details = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
            client.logger.error("AUTH", `Logout failed for user ${interaction.user.id}: ${details}`);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("❌ Logout Failed")
                        .setDescription("An error occurred while logging out. Please try again later.")
                ],
                flags: MessageFlags.Ephemeral
            });
        }
    }
});
