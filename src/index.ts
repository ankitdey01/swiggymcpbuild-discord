import "dotenv/config.js";
import { CustomClient } from "./structure/index.js";
import config from "./config";
import { GatewayIntentBits } from "discord.js";

const client = new CustomClient({
    data: config,
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: { parse: ["everyone", "roles", "users"] }
});

export default client;

client.start();