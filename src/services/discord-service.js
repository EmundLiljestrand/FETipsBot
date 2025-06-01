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
        this.scheduleTime = config.scheduleTime || "0 9 * * 1-5"; // Default 09:00, Monday-Friday only
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

        // När ett meddelande tas emot
        this.client.on("messageCreate", async (message) => {
            if (message.author.bot) return;

            try {
                // Hantera olika kommandon
                if (message.content === "!dagens-tips") {
                    await this.handleDailyTipCommand(message);
                } else if (message.content === "!frontend-tips") {
                    await this.handleFrontendTipCommand(message);
                } else if (message.content === "!backend-tips") {
                    await this.handleBackendTipCommand(message);
                } else if (message.content === "!fullstack-tips") {
                    await this.handleFullstackTipCommand(message);
                } else if (message.content === "!random-tips") {
                    await this.handleRandomTipCommand(message);
                } else if (message.content === "!ai-reasoning") {
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
        await message.channel.send("🔍 Genererar frontend-tips...");
        const tip = await this.tipAgent.generateFrontendTip();
        await message.channel.send(
            `💡 **Dagens frontend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !frontend-tips
     */
    async handleFrontendTipCommand(message) {
        await message.channel.send("🔍 Genererar frontend-tips...");
        const tip = await this.tipAgent.generateFrontendTip();
        await message.channel.send(
            `💡 **Dagens frontend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !backend-tips
     */
    async handleBackendTipCommand(message) {
        await message.channel.send("🔍 Genererar backend-tips...");
        const tip = await this.tipAgent.generateBackendTip();
        await message.channel.send(
            `🛠️ **Dagens backend-tips:**\n${this.formatTip(tip)}`
        );
    }

    /**
     * Hanterar kommandot !fullstack-tips
     */
    async handleFullstackTipCommand(message) {
        await message.channel.send("🔍 Genererar fullstack-tips...");
        const tip = await this.tipAgent.generateFullstackTip();
        await message.channel.send(
            `🌐 **Dagens fullstack-tips:**\n${this.formatTip(tip)}`
        );
    }
    /**
     * Hanterar kommandot !random-tips (slumpmässigt val av kategori)
     */
    async handleRandomTipCommand(message) {
        await message.channel.send(
            "🎲 Slumpar fram vilken typ av tips som ska genereras..."
        );
        const agentResponse = await this.tipAgent.generateDailyTip();
        await message.channel.send(
            `${agentResponse.prefix}\n${this.formatTip(agentResponse.tip)}`
        );
    }
    /**
     * Hanterar kommandot !ai-reasoning (visa resonemang om slumpmässigt vald kategori)
     */
    async handleAIReasoningCommand(message) {
        await message.channel.send(
            "🤖 AI-agenten reflekterar över slumpmässigt vald kategori..."
        );
        const agentResponse = await this.tipAgent.generateDailyTip();
        await message.channel.send(
            `**AI-agentens resonemang:**\n${this.formatTip(
                agentResponse.thinking
            )}`
        );
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
     * Bestämmer vilken kategori som ska skickas baserat på veckodagens rotation
     * Måndag: frontend, Tisdag: backend, Onsdag: fullstack, Torsdag: frontend, Fredag: backend
     */
    getTodayCategory() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

        switch (dayOfWeek) {
            case 1: // Måndag
                return "frontend";
            case 2: // Tisdag
                return "backend";
            case 3: // Onsdag
                return "fullstack";
            case 4: // Torsdag
                return "frontend";
            case 5: // Fredag
                return "backend";
            default:
                // Weekends should not happen due to cron schedule, but fallback to frontend
                console.warn(
                    `Unexpected day of week for tip generation: ${dayOfWeek}`
                );
                return "frontend";
        }
    }

    /**
     * Skickar ett dagligt tips
     */
    async sendDailyTip() {
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            if (channel && channel.isTextBased()) {
                // Bestäm kategori baserat på veckodagens rotation
                const category = this.getTodayCategory();
                console.log(`Sending ${category} tip for today`);

                const agentResponse = await this.tipAgent.generateDailyTip(
                    category
                );

                // Skicka tipset utan resonemang/tänkande
                await channel.send(
                    `${agentResponse.prefix}\n${this.formatTip(
                        agentResponse.tip
                    )}`
                );
                console.log(`Daily ${category} tip sent successfully`);

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
