import { AnySelectMenuInteraction, ButtonInteraction, ChatInputCommandInteraction, Colors, EmbedBuilder, MessageFlags, ModalSubmitInteraction } from "discord.js";
import config from "../../config.js";
import { logger } from "../classes/Logger.js";

export type ValidInteractionTypes =
    ChatInputCommandInteraction |
    ButtonInteraction |
    AnySelectMenuInteraction |
    ModalSubmitInteraction;

export async function reply(interaction: ValidInteractionTypes, emoji: string, description: string, ephemeral: boolean = false) {
    if (interaction.replied || interaction.deferred) {
        logger.warn("Interaction", "Attempted to reply to an already handled interaction");
        return;
    }

    const embedColor = emoji === "❌" ? Colors.DarkRed : config.color;

    return interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(`\`${emoji}\` | **${description}**`)
        ],
        ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {})
    }).catch((error) => {
        logger.error("Interaction", `Failed to reply to interaction: ${error instanceof Error ? error.message : String(error)}`);
    });
}