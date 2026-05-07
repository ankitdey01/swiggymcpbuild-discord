import { ChatInputCommandInteraction, Events, InteractionType, EmbedBuilder } from "discord.js";
import { Event, CustomClient, reply } from "../../structure/index.js";

function getDiscordApiErrorCode(error: unknown): number | undefined {
    if (!error || typeof error !== "object" || !("code" in error)) return undefined;

    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : undefined;
}

export default new Event({
    name: Events.InteractionCreate,
    async execute(interaction: ChatInputCommandInteraction, client: CustomClient) {
        if (interaction.type !== InteractionType.ApplicationCommand) return;

        const command = client.commands.get(interaction.commandName);

        if (!command) {
            if (!interaction.replied && !interaction.deferred) {
                await reply(interaction, "X", "This command does not exist").catch(() => {});
            }
            return client.commands.delete(interaction.commandName);
        }

        // Check bot owner only
        if (command.botOwnerOnly && !client.data.developers?.includes(interaction.user.id)) {
            if (!interaction.replied && !interaction.deferred) {
                return reply(interaction, "X", "This command is only available for bot developers").catch(() => {});
            }
            return;
        }

        // Execute command with error handling
        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error("Command execution error:", error);

            const errorCode = getDiscordApiErrorCode(error);

            // Discord already rejected or acknowledged this interaction, so avoid a second response attempt.
            if (errorCode === 10062 || errorCode === 40060) {
                return;
            }

            // Only try to respond if we haven't already
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor("DarkRed")
                            .setDescription("An error occurred while executing this command")
                        ]
                    });
                } catch (replyError) {
                    const replyCode = getDiscordApiErrorCode(replyError);
                    if (replyCode !== 10062 && replyCode !== 40060) {
                        console.error("Failed to send error message:", replyError);
                    }
                }
            } else {
                try {
                    await interaction.editReply({
                        embeds: [new EmbedBuilder()
                            .setColor("DarkRed")
                            .setDescription("An error occurred while executing this command")
                        ]
                    });
                } catch (editError) {
                    const editCode = getDiscordApiErrorCode(editError);
                    if (editCode !== 10062 && editCode !== 40060) {
                        console.error("Failed to edit reply with error message:", editError);
                    }
                }
            }
        }
    }
});