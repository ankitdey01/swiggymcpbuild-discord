import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CustomClient, SlashCommand } from "../../structure/index.js";

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("logout")
        .setDescription("Disconnect your Swiggy account from the Discord bot"),
    category: "Auth",
    async execute(interaction) {
        const client = interaction.client as CustomClient

        // Check if Swiggy auth is initialized
        if (!client.swiggyAuth) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("❌ Auth Not Configured")
                        .setDescription("Swiggy authentication is not yet configured."),
                ],
                ephemeral: true
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
                ephemeral: true
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
                ephemeral: true
            });
        } catch (error: any) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("❌ Logout Failed")
                        .setDescription(`Failed to logout: ${error.message}`)
                ],
                ephemeral: true
            });
        }
    }
});
