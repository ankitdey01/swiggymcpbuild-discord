import { ColorResolvable } from "discord.js";

export default {
    token: process.env.DISCORD_TOKEN || "",
    clientId: process.env.SWIGGY_CLIENT_ID || "YOUR_CLIENT_ID",
    developers: (process.env.DEVELOPER_IDS || "YOUR_DISCORD_USER_ID").split(","),
    handlers: {
        commands: "./dist/commands",
        events: "./dist/events"
    },
    color: "Blue" as ColorResolvable
};
