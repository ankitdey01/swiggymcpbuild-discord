import { ActionRowBuilder, AnySelectMenuInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, ModalSubmitInteraction } from "discord.js";
import { reply } from "./index.js";

type ValidInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction

export async function paginate(interaction: ValidInteraction, embeds: EmbedBuilder[]) {
    if (embeds.length === 0) {
        throw new Error("Embeds array cannot be empty");
    }
    await interaction.deferReply();

    const previousPage = "Previous Page";
    const nextPage = "Next Page";
    const closePage = "Close";
    const firstPage = "First Page";
    const lastPage = "Last Page";
    const buttons = [
        new ButtonBuilder()
            .setCustomId("pagination-firstPage")
            .setLabel(firstPage)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("pagination-previousPage")
            .setLabel(previousPage)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("pagination-closePage")
            .setLabel(closePage)
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("pagination-nextPage")
            .setLabel(nextPage)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("pagination-lastPage")
            .setLabel(lastPage)
            .setStyle(ButtonStyle.Primary)
    ];

    // Set initial button states
    if (embeds.length === 1) {
        buttons[0].setDisabled(true); // First page
        buttons[1].setDisabled(true); // Previous page  
        buttons[3].setDisabled(true); // Next page
        buttons[4].setDisabled(true); // Last page
    }

    const row = new ActionRowBuilder<ButtonBuilder>().setComponents(...buttons);

    let currentPage: number = 0;
    const message = await interaction.editReply({ embeds: [embeds[currentPage]], components: [row] });

    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60 * 1000 * 5 });

    collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return await reply(i, "❌", "This is not your message");

        switch (i.customId) {
            case "pagination-firstPage": {
                currentPage = 0;
                break;
            }

            case "pagination-previousPage": {
                currentPage--;
                break;
            }

            case "pagination-closePage": {
                buttons[0].setDisabled(true);
                buttons[1].setDisabled(true);
                buttons[2].setDisabled(true);
                buttons[3].setDisabled(true);
                buttons[4].setDisabled(true);
                
                const closedRow = new ActionRowBuilder<ButtonBuilder>().setComponents(buttons);
                await i.deferUpdate();
                await message.edit({ components: [closedRow] });
                collector.stop();
                return;
            }

            case "pagination-nextPage": {
                currentPage++;
                break;
            }

            case "pagination-lastPage": {
                currentPage = embeds.length - 1;
                break;
            }
        }

        // Handle single page case
        if (embeds.length === 1) {
            buttons[0].setDisabled(true); // First page
            buttons[1].setDisabled(true); // Previous page  
            buttons[3].setDisabled(true); // Next page
            buttons[4].setDisabled(true); // Last page
        } else {
            switch (currentPage) {
                case 0: {
                    buttons[0].setDisabled(true);  // First page
                    buttons[1].setDisabled(true);  // Previous page
                    buttons[3].setDisabled(false); // Next page
                    buttons[4].setDisabled(false); // Last page
                    break;
                }

                case embeds.length - 1: {
                    buttons[0].setDisabled(false); // First page
                    buttons[1].setDisabled(false); // Previous page
                    buttons[3].setDisabled(true);  // Next page
                    buttons[4].setDisabled(true);  // Last page
                    break;
                }

                default: {
                    // Middle pages - enable all navigation buttons
                    buttons[0].setDisabled(false); // First page
                    buttons[1].setDisabled(false); // Previous page
                    buttons[3].setDisabled(false); // Next page
                    buttons[4].setDisabled(false); // Last page
                    break;
                }
            }
        }

        const newRow = new ActionRowBuilder<ButtonBuilder>().setComponents(buttons);

        await i.deferUpdate();
        await message.edit({ embeds: [embeds[currentPage]], components: [newRow] });
    });

    collector.on("end", async () => {

        buttons[0].setDisabled(true);
        buttons[1].setDisabled(true);
        buttons[2].setDisabled(true);
        buttons[3].setDisabled(true);
        buttons[4].setDisabled(true);

        const endRow = new ActionRowBuilder<ButtonBuilder>().setComponents(buttons)
        await message.edit({ components: [endRow] });
    });
}