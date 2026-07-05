import { ChatInputCommandInteraction, Events, InteractionType, EmbedBuilder } from "discord.js";
import { Event, CustomClient, reply, isIgnorableInteractionError } from "../../structure/index.js";

const ERROR_EMBED = new EmbedBuilder()
    .setColor("DarkRed")
    .setDescription("An error occurred while executing this command");

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
            client.logger.error("Command", `${interaction.commandName}: ${error instanceof Error ? error.stack || error.message : String(error)}`);

            // Discord already rejected or acknowledged this interaction, so avoid a second response attempt.
            if (isIgnorableInteractionError(error)) return;

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ embeds: [ERROR_EMBED] });
                } else {
                    await interaction.editReply({ embeds: [ERROR_EMBED] });
                }
            } catch (responseError) {
                if (!isIgnorableInteractionError(responseError)) {
                    client.logger.error("Command", `Failed to send error response: ${responseError instanceof Error ? responseError.message : String(responseError)}`);
                }
            }
        }
    }
});