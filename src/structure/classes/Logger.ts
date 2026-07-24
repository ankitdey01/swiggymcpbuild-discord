import Chalk from "chalk";

export class Logger {
    error(group: string, description: string) {
        console.log(`[ ${getDateInFormat()} ] | ${Chalk.redBright(`[ ${group.toUpperCase()} ]`)} ${Chalk.red(description)}`);
    }

    warn(group: string, description: string) {
        console.log(`[ ${getDateInFormat()} ] | ${Chalk.yellowBright(`[ ${group.toUpperCase()} ]`)} ${Chalk.yellow(description)}`);
    }

    debug(group: string, description: string) {
        console.log(`[ ${getDateInFormat()} ] | ${Chalk.yellowBright(`[ ${group.toUpperCase()} ]`)} ${Chalk.cyanBright(description)}`);
    }

    trace(group: string, description: string) {
        console.log(`[ ${getDateInFormat()} ] | ${Chalk.gray(`[ ${group.toUpperCase()} ]`)} ${Chalk.gray(description)}`);
    }

    info(group: string, description: string) {
        console.log(`[ ${getDateInFormat()} ] | ${Chalk.greenBright(`[ ${group.toUpperCase()} ]`)} ${Chalk.cyanBright(description)}`);
    }

    highlight(text: string, type: "success" | "error") {
        return type === "success" ? Chalk.yellow(text) : Chalk.red(text);
    }
}

/**
 * Shared logger instance for modules that run outside the Discord client
 * (auth, MCP transport, startup). The client reuses this same instance so all
 * output is consistent.
 */
export const logger = new Logger();

function getDateInFormat() {
    const pad = (num: number, length: number) => num.toString().padStart(length, "0");
    const date = new Date();

    return `${pad(date.getFullYear(), 4)}/${pad(date.getMonth() + 1, 2)}/${pad(date.getDate(), 2)} | ${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}`;
}