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
            console.log("Initializing Discord service...");

            // Rensa alla befintliga event listeners för att undvika duplicering
            this.client.removeAllListeners();

            // Sätt upp event handlers med endast en instans
            this.setupEventHandlers();

            console.log("Event handlers set up");

            // Logga in till Discord
            await this.client.login(this.token);
            console.log("Logged in to Discord");

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
        console.log("Setting up event handlers...");

        // När boten är redo - använd once för att säkerställa att detta endast händer en gång
        this.client.once("ready", () => {
            console.log(`🤖 Bot inloggad som ${this.client.user.tag}`);
            this.isReady = true;

            // Sätt upp schemalagd uppgift
            this.scheduleDaily();
        });

        // Logga alla befintliga listeners innan vi lägger till vår egen
        console.log(
            `Current messageCreate listeners: ${this.client.listenerCount(
                "messageCreate"
            )}`
        );

        // Ta bort alla befintliga messageCreate event listeners för att undvika dubbla anrop
        this.client.removeAllListeners("messageCreate");

        // Lägg till en ny message event listener
        this.client.on("messageCreate", async (message) => {
            // Ignorera meddelanden från andra bottar
            if (message.author.bot) return;

            try {
                // Logga mottaget kommando för felsökning
                console.log(
                    `Command received: ${message.content} from ${message.author.tag}`
                );

                // Hantera olika kommandon med exakt matchning
                const command = message.content.trim();

                // Använd en switch-sats för att hantera commands och säkerställ att endast ett command körs
                switch (command) {
                    case "!dagens-tips":
                        await this.handleDailyTipCommand(message);
                        break;
                    case "!frontend-tips":
                        await this.handleFrontendTipCommand(message);
                        break;
                    case "!backend-tips":
                        await this.handleBackendTipCommand(message);
                        break;
                    case "!fullstack-tips":
                        await this.handleFullstackTipCommand(message);
                        break;
                    case "!ai-tips":
                        await this.handleAITipCommand(message);
                        break;
                    case "!ai-reasoning":
                        await this.handleAIReasoningCommand(message);
                        break;
                    // Inget default-fall för att undvika att hantera irrelevanta kommandon
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
        console.log("handleAITipCommand called - preparing response");

        // Visa att boten arbetar - spara referensen till meddelandet
        let processingMsg;
        try {
            processingMsg = await message.channel.send(
                "🤖 AI-agenten tänker på vilken typ av tips som behövs..."
            );
            console.log("Sent processing message with ID:", processingMsg.id);
        } catch (msgError) {
            console.error("Error sending processing message:", msgError);
            // Fortsätt även om vi inte kan skicka processingMsg
        }

        try {
            console.log("Starting to generate AI tip");

            // Generera tipset (endast ett anrop)
            const agentResponse = await this.tipAgent.generateDailyTip();
            console.log(
                `AI tip generated with category: ${agentResponse.category}`
            );

            // Försök radera "tänker"-meddelandet om det finns
            if (processingMsg) {
                try {
                    await processingMsg.delete();
                    console.log("Successfully deleted processing message");
                } catch (deleteError) {
                    console.log(
                        "Could not delete processing message:",
                        deleteError.message
                    );
                }
            }

            // Skicka det faktiska tipset
            console.log("Sending final tip message");
            await message.channel.send(
                `${agentResponse.prefix}\n${this.formatTip(agentResponse.tip)}`
            );
            console.log("Final tip message sent");
        } catch (error) {
            console.error("Error handling AI tip command:", error);

            // Försök radera processingMsg om ett fel uppstår och meddelandet finns
            if (processingMsg) {
                try {
                    await processingMsg.delete();
                    console.log("Deleted processing message after error");
                } catch (deleteError) {
                    console.log(
                        "Could not delete processing message after error:",
                        deleteError.message
                    );
                }
            }

            // Skicka felmeddelande
            await message.channel.send(
                "Ett fel uppstod när AI-tipset skulle genereras."
            );
        }
    }

    /**
     * Hanterar kommandot !ai-reasoning (visa agentens resonemang)
     */
    async handleAIReasoningCommand(message) {
        console.log("handleAIReasoningCommand called - preparing response");

        // Visa att boten arbetar
        let processingMsg;
        try {
            processingMsg = await message.channel.send(
                "🤖 AI-agenten analyserar tidigare tips och bestämmer nästa steg..."
            );
            console.log(
                "Sent reasoning processing message with ID:",
                processingMsg.id
            );
        } catch (msgError) {
            console.error(
                "Error sending reasoning processing message:",
                msgError
            );
        }

        try {
            console.log("Getting agent reasoning");

            // Använd samma response som för !ai-tips för att undvika dubbla API-anrop
            const agentResponse = await this.tipAgent.getAgentReasoning();
            console.log("Agent reasoning generated");

            // Radera "analyserar"-meddelandet först om det finns
            if (processingMsg) {
                try {
                    await processingMsg.delete();
                    console.log(
                        "Successfully deleted reasoning processing message"
                    );
                } catch (deleteError) {
                    console.log(
                        "Could not delete reasoning processing message:",
                        deleteError.message
                    );
                }
            }

            // Skicka resultatet
            console.log("Sending reasoning message");
            await message.channel.send(
                `**AI-agentens resonemang:**\n${this.formatTip(
                    agentResponse.thinking
                )}`
            );
            console.log("Reasoning message sent");
        } catch (error) {
            console.error("Error handling AI reasoning command:", error);

            // Försök radera processingMsg om ett fel uppstår och det finns
            if (processingMsg) {
                try {
                    await processingMsg.delete();
                    console.log(
                        "Deleted reasoning processing message after error"
                    );
                } catch (deleteError) {
                    console.log(
                        "Could not delete reasoning processing message after error:",
                        deleteError.message
                    );
                }
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
            console.log("Attempting to send scheduled daily tip...");
            const channel = await this.client.channels.fetch(this.channelId);

            if (channel && channel.isTextBased()) {
                console.log("Channel found, generating daily tip...");
                const agentResponse = await this.tipAgent.generateDailyTip();
                console.log(
                    `Generated daily tip of category: ${agentResponse.category}`
                );

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
