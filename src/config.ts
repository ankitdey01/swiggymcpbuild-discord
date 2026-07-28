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
    // Warn but don't fail if SWIGGY_CLIENT_ID is not set - bot can still run without Swiggy features
    if (!config.clientId || config.clientId === "YOUR_CLIENT_ID") {
        console.warn(`⚠️  Warning: SWIGGY_CLIENT_ID not configured. Swiggy OAuth will be unavailable.`);
    }

    const validDevelopers = config.developers
        .map((id) => id.trim())
        .filter((id) => id && id !== "YOUR_DISCORD_USER_ID");

    if (validDevelopers.length === 0) {
        console.warn(`⚠️  Warning: DEVELOPER_IDS not configured. Developer commands will not be available.`);
    }
}

validateConfig();

export default config;