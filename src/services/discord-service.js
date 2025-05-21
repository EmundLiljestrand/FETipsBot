import { Client, GatewayIntentBits } from "discord.js";
import cron from "node-cron";

/**
 * Service för att hantera Discord-integrationen
 */
export class DiscordService {
    constructor(token, tipAgent, config = {}) {
        this.token = token;
        this.tipAgent = tipAgent;
        this.channelId = config.channelId || "1373995255971582003"; // Default eller från config
        this.MAX_LENGTH = 2000; // Discord meddelandegräns
        this.scheduleTime = config.scheduleTime || "0 9 * * *"; // Default 09:00
        this.timezone = config.timezone || "Europe/Stockholm";

        // Skapa Discord-klienten
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        // Interna tillstånd
        this.isReady = false;
        this.scheduledJob = null;
    }

    /**
     * Initialiserar Discord-klienten och sätter upp event handlers
     */
    async initialize() {
        try {
            // Sätt upp event handlers
            this.setupEventHandlers();

            // Logga in till Discord
            await this.client.login(this.token);

            return this;
        } catch (error) {
            console.error("Failed to initialize Discord service:", error);
            throw error;
        }
    }
    /**
     * Sätter upp event handlers för Discord-klienten
     */
    setupEventHandlers() {
        // När boten är redo
        this.client.once("ready", () => {
            console.log(`🤖 Bot inloggad som ${this.client.user.tag}`);
            this.isReady = true;

            // Sätt upp schemalagd uppgift
            this.scheduleDaily();
        });

        // När ett meddelande tas emot - använd .once() för att undvika dubbla anrop
        this.client.on("messageCreate", async (message) => {
            // Ignorera meddelanden från andra bottar
            if (message.author.bot) return;

            try {
                // Logga mottaget kommando för felsökning
                console.log(
                    `Command received: ${message.content} from ${message.author.tag}`
                );

                // Hantera olika kommandon - se till att exakt matchning görs
                const command = message.content.trim();

                if (command === "!dagens-tips") {
                    await this.handleDailyTipCommand(message);
                } else if (command === "!frontend-tips") {
                    await this.handleFrontendTipCommand(message);
                } else if (command === "!backend-tips") {
                    await this.handleBackendTipCommand(message);
                } else if (command === "!fullstack-tips") {
                    await this.handleFullstackTipCommand(message);
                } else if (command === "!ai-tips") {
                    await this.handleAITipCommand(message);
                } else if (command === "!ai-reasoning") {
                    await this.handleAIReasoningCommand(message);
                }
            } catch (error) {
                console.error("Error handling message:", error);
                message.channel.send(
                    "Ett fel uppstod när kommandot skulle bearbetas."
                );
            }
        });
    }
    /**
     * Hanterar kommandot !dagens-tips (frontend-tips)
     */
    async handleDailyTipCommand(message) {
        const processingMsg = await message.channel.send(
            "🔍 Genererar frontend-tips..."
        );
        const tip = await this.tipAgent.generateFrontendTip();

        try {
            await processingMsg.delete();
        } catch (error) {
            console.log("Could not delete processing message, continuing...");
        }

        await message.channel.send(
            `💡 **Dagens frontend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !frontend-tips
     */
    async handleFrontendTipCommand(message) {
        const processingMsg = await message.channel.send(
            "🔍 Genererar frontend-tips..."
        );
        const tip = await this.tipAgent.generateFrontendTip();

        try {
            await processingMsg.delete();
        } catch (error) {
            console.log("Could not delete processing message, continuing...");
        }

        await message.channel.send(
            `💡 **Dagens frontend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !backend-tips
     */
    async handleBackendTipCommand(message) {
        const processingMsg = await message.channel.send(
            "🔍 Genererar backend-tips..."
        );
        const tip = await this.tipAgent.generateBackendTip();

        try {
            await processingMsg.delete();
        } catch (error) {
            console.log("Could not delete processing message, continuing...");
        }

        await message.channel.send(
            `🛠️ **Dagens backend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !fullstack-tips
     */
    async handleFullstackTipCommand(message) {
        const processingMsg = await message.channel.send(
            "🔍 Genererar fullstack-tips..."
        );
        const tip = await this.tipAgent.generateFullstackTip();

        try {
            await processingMsg.delete();
        } catch (error) {
            console.log("Could not delete processing message, continuing...");
        }

        await message.channel.send(
            `🌐 **Dagens fullstack-tips:**\n${this.formatTip(tip)}`
        );
    }
    /**
     * Hanterar kommandot !ai-tips (agent väljer kategori)
     */
    async handleAITipCommand(message) {
        // Första meddelandet som visar att boten arbetar
        const processingMsg = await message.channel.send(
            "🤖 AI-agenten tänker på vilken typ av tips som behövs..."
        );

        try {
            // Generera tipset
            const agentResponse = await this.tipAgent.generateDailyTip();

            // Radera "tänker"-meddelandet först innan vi skickar det nya meddelandet
            try {
                await processingMsg.delete();
            } catch (error) {
                console.log(
                    "Could not delete processing message, continuing..."
                );
            }

            // Skicka resultatet efter att vi har raderat "tänker"-meddelandet
            await message.channel.send(
                `${agentResponse.prefix}\n${this.formatTip(agentResponse.tip)}`
            );
        } catch (error) {
            console.error("Error handling AI tip command:", error);

            // Försök radera processingMsg om ett fel uppstår
            try {
                await processingMsg.delete();
            } catch (deleteError) {
                console.log("Could not delete processing message after error");
            }

            await message.channel.send(
                "Ett fel uppstod när AI-tipset skulle genereras."
            );
        }
    }
    /**
     * Hanterar kommandot !ai-reasoning (visa agentens resonemang)
     */
    async handleAIReasoningCommand(message) {
        // Först skicka ett meddelande som visar att boten arbetar
        const processingMsg = await message.channel.send(
            "🤖 AI-agenten analyserar tidigare tips och bestämmer nästa steg..."
        );

        try {
            // Använd samma response som för !ai-tips för att undvika dubbla API-anrop
            const agentResponse = await this.tipAgent.getAgentReasoning();

            // Radera "analyserar"-meddelandet först innan vi skickar det nya meddelandet
            try {
                await processingMsg.delete();
            } catch (error) {
                console.log(
                    "Could not delete processing message, continuing..."
                );
            }

            // Skicka resultatet efter att vi har raderat "analyserar"-meddelandet
            await message.channel.send(
                `**AI-agentens resonemang:**\n${this.formatTip(
                    agentResponse.thinking
                )}`
            );
        } catch (error) {
            console.error("Error handling AI reasoning command:", error);

            // Försök radera processingMsg om ett fel uppstår
            try {
                await processingMsg.delete();
            } catch (deleteError) {
                console.log("Could not delete processing message after error");
            }

            await message.channel.send(
                "Ett fel uppstod när AI-reasoning skulle genereras."
            );
        }
    }

    /**
     * Formaterar tipset för att passa inom Discords teckenbegränsning
     */
    formatTip(tip) {
        if (!tip) return "Kunde inte generera ett tips just nu.";
        return tip.length > this.MAX_LENGTH
            ? tip.slice(0, this.MAX_LENGTH - 3) + "..."
            : tip;
    }

    /**
     * Sätter upp schemalagd daglig uppgift för att skicka ett tips
     */
    scheduleDaily() {
        // Avbryt tidigare schemalagda uppgifter om de finns
        if (this.scheduledJob) {
            this.scheduledJob.stop();
        }

        // Schemalägg ny uppgift
        this.scheduledJob = cron.schedule(
            this.scheduleTime,
            async () => {
                try {
                    await this.sendDailyTip();
                } catch (error) {
                    console.error("Error sending scheduled tip:", error);
                }
            },
            {
                timezone: this.timezone,
            }
        );

        console.log(
            `Scheduled daily tip at "${this.scheduleTime}" (${this.timezone})`
        );
    }

    /**
     * Skickar ett dagligt tips
     */
    async sendDailyTip() {
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (channel && channel.isTextBased()) {
                const agentResponse = await this.tipAgent.generateDailyTip();

                // Skicka tipset utan resonemang/tänkande
                await channel.send(
                    `${agentResponse.prefix}\n${this.formatTip(
                        agentResponse.tip
                    )}`
                );
                console.log("Daily tip sent successfully");

                return true;
            } else {
                console.error("Could not find text channel for daily tip");
                return false;
            }
        } catch (error) {
            console.error("Error sending daily tip:", error);
            return false;
        }
    }

    /**
     * Stänger ner Discord-tjänsten
     */
    async shutdown() {
        try {
            // Stoppa schemalagda jobb
            if (this.scheduledJob) {
                this.scheduledJob.stop();
            }

            // Logga ut från Discord
            if (this.client && this.client.isReady()) {
                await this.client.destroy();
                console.log("Discord client destroyed");
            }
        } catch (error) {
            console.error("Error during Discord service shutdown:", error);
        }
    }
}

export default DiscordService;
