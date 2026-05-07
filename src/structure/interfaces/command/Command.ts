import { SharedNameAndDescription, SlashCommandBuilder } from "discord.js";
import { BaseApplicationCommand } from "./index.js";

export class SlashCommand {
    public data: SharedNameAndDescription | SlashCommandBuilder;
    public category?: string;
    public botOwnerOnly: boolean;
    public execute;

    constructor (options: BaseApplicationCommand) {
        this.data = options.data;
        this.category = options.category;
        this.botOwnerOnly = options.botOwnerOnly || false;
        this.execute = options.execute;
    }
}