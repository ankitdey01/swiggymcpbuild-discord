import "dotenv/config.js";
import { CustomClient } from "./structure/index.js";
import config from "./config.js";
import { GatewayIntentBits } from "discord.js";

const client = new CustomClient({
    data: config,
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: ["everyone", "roles", "users"] }
});

export default client;

client.start().catch((error) => {
    console.error("Failed to start client:", error);
    process.exit(1);
});