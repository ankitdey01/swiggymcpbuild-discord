import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { CustomClient, SlashCommand } from "../../structure/index.js";

export default new SlashCommand({
    data: new SlashCommandBuilder()
        .setName("login")
        .setDescription("Authenticate with your Swiggy account"),
    category: "Auth",
    async execute(interaction) {
        const client = interaction.client as CustomClient;

        // Check if Swiggy auth is initialized
        if (!client.swiggyAuth) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setTitle("❌ Auth Not Configured")
                        .setDescription("Swiggy authentication is not yet configured. Please check with the bot administrator.")
                ],
                ephemeral: true
            });
        }

        // Check if user is already authenticated
        if (client.swiggyAuth.isAuthenticated(interaction.user.id)) {
            const expiry = client.swiggyAuth.getTokenExpiry(interaction.user.id);
            const daysLeft = Math.floor(expiry! / 86400);

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Yellow")
                        .setTitle("⚠️ Already Authenticated")
                        .setDescription(`You're already logged in to Swiggy.`)
                        .addFields({
                            name: "Token Expires In",
                            value: `${daysLeft} days`,
                            inline: false
                        })
                        .addFields({
                            name: "Want to Re-authenticate?",
                            value: "Use `/logout` first, then run `/login` again.",
                            inline: false
                        })
                ],
                ephemeral: true
            });
        }

        // Generate authorization URL
        const authUrl = client.swiggyAuth.getAuthorizationUrl(interaction.user.id);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Blurple")
                    .setTitle("🔐 Swiggy Authentication")
                    .setDescription(
                        "Click the button below to authenticate with your Swiggy account. This will allow the bot to access your Swiggy data."
                    )
                    .addFields({
                        name: "Permissions Required",
                        value: "• Access Swiggy tools\n• Read resources\n• Use prompts",
                        inline: false
                    })
                    .addFields({
                        name: "Security",
                        value: "Your token is stored securely and never shared.",
                        inline: false
                    })
                    .setFooter({ text: "You will be redirected to Swiggy to complete authentication" })
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "Login with Swiggy",
                            url: authUrl
                        }
                    ]
                }
            ],
            ephemeral: true
        });
    }
});
