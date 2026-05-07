import { SlashCommand } from "../../structure/index.js";
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default new SlashCommand({
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is alive"),
  category: "General",

  async execute(interaction) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Pong")
          .setDescription("The bot is responding.")
      ]
    });
  }
});
