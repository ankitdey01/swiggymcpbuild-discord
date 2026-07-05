import Chalk from "chalk";

export class Logger {
    error(group: string, description: string) {
        return console.log("[ " + getDateInFormat() + " ]" + " | " + Chalk.redBright("[ " + group.toUpperCase() + " ]") + " " + Chalk.red(description));
    }

    warn(group: string, description: string) {
        return console.log("[ " + getDateInFormat() + " ]" + " | " + Chalk.yellowBright("[ " + group.toUpperCase() + " ]") + " " + Chalk.yellow(description));
    }

    debug(group: string, description: string) {
        return console.log("[ " + getDateInFormat() + " ]" + " | " + Chalk.yellowBright("[ " + group.toUpperCase() + " ]") + " " + Chalk.cyanBright(description));
    }

    trace(group: string, description: string) {
        return console.log("[ " + getDateInFormat() + " ]" + " | " + Chalk.gray("[ " + group.toUpperCase() + " ]") + " " + Chalk.gray(description));
    }

    info(group: string, description: string) {
        return console.log("[ " + getDateInFormat() + " ]" + " | " + Chalk.greenBright("[ " + group.toUpperCase() + " ]") + " " + Chalk.cyanBright(description));
    }

    highlight(text: string, type: "success" | "error") {
        if (type === "success") return Chalk.yellow(text);
        else return Chalk.red(text);
    }
}

/**
 * Shared logger instance for modules that run outside the Discord client
 * (auth, MCP transport, startup). The client reuses this same instance so all
 * output is consistent.
 */
export const logger = new Logger();

function getDateInFormat() {
    function toString(number: number, padLength: number) {
        return number.toString().padStart(padLength, "0");
    }

    const date = new Date();

    const dateTimeNow =
        toString(date.getFullYear(), 4)
        + "/" + toString(date.getMonth() + 1, 2)
        + "/" + toString(date.getDate(), 2)
        + " | " + toString(date.getHours(), 2)
        + ":" + toString(date.getMinutes(), 2)
        + ":" + toString(date.getSeconds(), 2);

    return dateTimeNow;
}