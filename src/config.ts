import { ColorResolvable } from "discord.js";

const config = {
    token: process.env.DISCORD_TOKEN || "",
    clientId: process.env.SWIGGY_CLIENT_ID || "YOUR_CLIENT_ID",
    developers: (process.env.DEVELOPER_IDS || "YOUR_DISCORD_USER_ID").split(","),
    handlers: {
        commands: "./dist/commands",
        events: "./dist/events"
    },
    color: "Blue" as ColorResolvable
};

function validateConfig() {
    if (!config.clientId || config.clientId === "YOUR_CLIENT_ID") {
        throw new Error(`Configuration error: clientId must be set via SWIGGY_CLIENT_ID environment variable and cannot be the placeholder "YOUR_CLIENT_ID".`);
    }

    const validDevelopers = config.developers
        .map((id) => id.trim())
        .filter((id) => id && id !== "YOUR_DISCORD_USER_ID");

    if (validDevelopers.length === 0) {
        throw new Error(`Configuration error: developers must be set via DEVELOPER_IDS environment variable (comma-separated Discord user IDs) and cannot contain the placeholder "YOUR_DISCORD_USER_ID" or be empty.`);
    }
}

validateConfig();

export default config;