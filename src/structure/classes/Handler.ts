import { Events, RESTPostAPIApplicationCommandsJSONBody, SlashCommandBuilder } from "discord.js";
import { getAllFiles } from "../functions/index.js";
import { Event, SlashCommand, BaseApplicationCommand } from "../interfaces/index.js";
import { CustomClient } from "./index.js";

export class Handler {
    private client: CustomClient;
    constructor(client: CustomClient) {
        this.client = client;
    }

    async loadCommands(directory: string) {
        const files = getAllFiles(directory);
        if (!files.length) return;
        const publicCommands: RESTPostAPIApplicationCommandsJSONBody[] = [];
        let loadedCommands = 0;

        for await (const file of files) {
            const command: SlashCommand = (await import(file)).default;

            publicCommands.push((command.data as SlashCommandBuilder).toJSON());

            this.client.commands.set((command.data as SlashCommandBuilder).name, command as BaseApplicationCommand);
            loadedCommands++;
        }

        if (loadedCommands !== 0) this.client.logger.info("System", `Commands Loaded : ${this.client.logger.highlight(loadedCommands.toString(), "success")}`);

        const pushCommands = async () => {
            await this.client.application?.commands.set(publicCommands);
            this.client.logger.info("System", "Application commands registered");
        };

        if (!this.client.isReady()) this.client.once(Events.ClientReady, () => pushCommands());
        else pushCommands();
    }

    async loadEvents(directory: string) {
        const files = getAllFiles(directory);
        if (!files.length) return;
        let loadedEvents = 0;

        for await (const file of files) {
            const { data: event }: Event = (await import(file)).default;

            const execute = (...args: unknown[]) => event?.execute(...args, this.client);

            // Discord.js event names are enum values, never empty strings or null
            // Truthy check is safe and more idiomatic than explicit null comparison
            if (event?.name) {
                event.once ? this.client.once(event.name, execute) : this.client.on(event.name, execute);
            } else if (event?.restEvent) {
                event.once ? this.client.rest.once(event.restEvent, execute) : this.client.rest.on(event.restEvent, execute);
            } else {
                throw new TypeError(`Event ${file.split("/").at(-2)}/${file.split("/").at(-1)} has no event name`);
            }
            loadedEvents++;
        }

        if (loadedEvents !== 0) this.client.logger.info("System", `Events Loaded : ${this.client.logger.highlight(loadedEvents.toString(), "success")}`);
    }

    catchErrors() {
        const formatError = (err: unknown) => 
            err instanceof Error ? err.stack || err.message : String(err);

        process
            .on("uncaughtException", (err) => {
                this.client.logger.error("System", `Uncaught Exception: ${formatError(err)}`);
            })
            .on("uncaughtExceptionMonitor", (err) => {
                this.client.logger.error("System", `Uncaught Exception (Monitor): ${formatError(err)}`);
            })
            .on("unhandledRejection", (reason) => {
                this.client.logger.error("System", `Unhandled Rejection: ${formatError(reason)}`);
            });
    }
}
