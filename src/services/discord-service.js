import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
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
                } else if (
                    message.content === "!help" ||
                    message.content === "!hjälp"
                ) {
                    await this.handleHelpCommand(message);
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
        const loadingEmbed = this.createLoadingEmbed("frontend");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const tip = await this.tipAgent.generateFrontendTip();
        const tipEmbed = this.createTipEmbed(tip, "frontend", false);

        await loadingMessage.edit({ embeds: [tipEmbed] });
    }
    /**
     * Hanterar kommandot !frontend-tips
     */
    async handleFrontendTipCommand(message) {
        const loadingEmbed = this.createLoadingEmbed("frontend");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const tip = await this.tipAgent.generateFrontendTip();
        const tipEmbed = this.createTipEmbed(tip, "frontend", false);

        await loadingMessage.edit({ embeds: [tipEmbed] });
    }
    /**
     * Hanterar kommandot !backend-tips
     */
    async handleBackendTipCommand(message) {
        const loadingEmbed = this.createLoadingEmbed("backend");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const tip = await this.tipAgent.generateBackendTip();
        const tipEmbed = this.createTipEmbed(tip, "backend", false);

        await loadingMessage.edit({ embeds: [tipEmbed] });
    }
    /**
     * Hanterar kommandot !fullstack-tips
     */
    async handleFullstackTipCommand(message) {
        const loadingEmbed = this.createLoadingEmbed("fullstack");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const tip = await this.tipAgent.generateFullstackTip();
        const tipEmbed = this.createTipEmbed(tip, "fullstack", false);

        await loadingMessage.edit({ embeds: [tipEmbed] });
    }
    /**
     * Hanterar kommandot !random-tips (slumpmässigt val av kategori)
     */
    async handleRandomTipCommand(message) {
        const loadingEmbed = this.createLoadingEmbed("random");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const agentResponse = await this.tipAgent.generateDailyTip();
        const tipEmbed = this.createTipEmbed(
            agentResponse.tip,
            agentResponse.category,
            false
        );

        await loadingMessage.edit({ embeds: [tipEmbed] });
    }
    /**
     * Hanterar kommandot !ai-reasoning (visa resonemang om slumpmässigt vald kategori)
     */
    async handleAIReasoningCommand(message) {
        const loadingEmbed = this.createLoadingEmbed("random");
        const loadingMessage = await message.channel.send({
            embeds: [loadingEmbed],
        });

        const agentResponse = await this.tipAgent.generateDailyTip();
        const reasoningEmbed = this.createReasoningEmbed(
            agentResponse.thinking,
            agentResponse.category
        );

        await loadingMessage.edit({ embeds: [reasoningEmbed] });
    }
    /**
     * Hanterar kommandot !help eller !hjälp
     */
    async handleHelpCommand(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x00d4aa) // Discord green
            .setTitle("🤖 ProgrammeringsTips Bot - Hjälp")
            .setDescription(
                "Jag hjälper dig att förbättra dina programmeringskunskaper med dagliga tips!"
            )
            .addFields(
                {
                    name: "📅 Automatiska Tips",
                    value:
                        "Jag skickar automatiskt tips **måndag-fredag kl 09:00**:\n" +
                        "• Måndag: Frontend\n" +
                        "• Tisdag: Backend\n" +
                        "• Onsdag: Fullstack\n" +
                        "• Torsdag: Frontend\n" +
                        "• Fredag: Backend",
                    inline: false,
                },
                {
                    name: "🎯 Manuella Kommandon",
                    value:
                        "`!frontend-tips` - Frontend tips\n" +
                        "`!backend-tips` - Backend tips\n" +
                        "`!fullstack-tips` - Fullstack tips\n" +
                        "`!random-tips` - Slumpmässigt tips\n" +
                        "`!ai-reasoning` - AI:ns resonemang",
                    inline: true,
                },
                {
                    name: "💡 Tips-kategorier",
                    value:
                        "**Frontend:** CSS, React, JavaScript, UX/UI\n" +
                        "**Backend:** Databaser, API, Security, Node.js\n" +
                        "**Fullstack:** DevOps, Integration, Arkitektur",
                    inline: true,
                },
                {
                    name: "🚀 AI-motorn",
                    value: "Powered by **Gemini 2.5 Pro** för bästa kvalitet!",
                    inline: false,
                }
            )
            .setFooter({
                text: "ProgrammeringsTips Bot • Skapad för att hjälpa utvecklare växa",
                iconURL:
                    "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/github.svg",
            })
            .setTimestamp();

        await message.channel.send({ embeds: [helpEmbed] });
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

                // Skicka tipset som snygg embed
                const tipEmbed = this.createTipEmbed(
                    agentResponse.tip,
                    agentResponse.category,
                    true
                );
                await channel.send({ embeds: [tipEmbed] });

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
     * Skapar en snygg embed för tips
     */
    createTipEmbed(tip, category, isScheduled = false) {
        const categoryConfig = {
            frontend: {
                color: 0x61dafb, // React blue
                emoji: "💡",
                title: "Frontend Tips",
                icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/javascript.svg",
            },
            backend: {
                color: 0x68a063, // Node.js green
                emoji: "🛠️",
                title: "Backend Tips",
                icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/nodedotjs.svg",
            },
            fullstack: {
                color: 0x764abc, // Purple
                emoji: "🌐",
                title: "Fullstack Tips",
                icon: "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/stackoverflow.svg",
            },
        };

        const config = categoryConfig[category] || categoryConfig.frontend;
        const currentDate = new Date().toLocaleDateString("sv-SE", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setTitle(`${config.emoji} ${config.title}`)
            .setDescription(this.formatTipContent(tip))
            .addFields(
                {
                    name: "📅 Datum",
                    value: currentDate,
                    inline: true,
                },
                {
                    name: "🎯 Kategori",
                    value: category.charAt(0).toUpperCase() + category.slice(1),
                    inline: true,
                },
                {
                    name: "⚡ Typ",
                    value: isScheduled ? "Schemalagt tips" : "Manuellt tips",
                    inline: true,
                }
            )
            .setFooter({
                text: "ProgrammeringsTips Bot • Kodglädje varje dag!",
                iconURL:
                    "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/discord.svg",
            })
            .setTimestamp();

        return embed;
    }

    /**
     * Formaterar tips-innehållet för bättre läsbarhet
     */
    formatTipContent(tip) {
        if (!tip) return "Kunde inte generera ett tips just nu.";

        // Begränsa längden för embed description (max 4096 tecken)
        if (tip.length > 3800) {
            tip = tip.slice(0, 3800) + "...";
        }

        // Förbättra formatering
        return tip
            .replace(/\*\*(.*?)\*\*/g, "**$1**") // Behåll bold formatting
            .replace(/`([^`]+)`/g, "`$1`") // Behåll inline code
            .replace(/```(\w+)?\n([\s\S]*?)```/g, "```$1\n$2```"); // Behåll code blocks
    }

    /**
     * Skapar en snygg "loading" embed
     */
    createLoadingEmbed(category) {
        const emoji = {
            frontend: "💡",
            backend: "🛠️",
            fullstack: "🌐",
            random: "🎲",
        };

        return new EmbedBuilder()
            .setColor(0xffd700) // Gold color for loading
            .setTitle(`${emoji[category] || "🔍"} Genererar tips...`)
            .setDescription(
                "AI-agenten arbetar på att skapa ett unikt och användbart tips för dig!"
            )
            .addFields({
                name: "⏳ Status",
                value: "Bearbetar...",
                inline: true,
            })
            .setFooter({
                text: "Detta kan ta en liten stund...",
                iconURL:
                    "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg",
            })
            .setTimestamp();
    }

    /**
     * Skapar en snygg embed för AI-reasoning
     */
    createReasoningEmbed(thinking, category) {
        return new EmbedBuilder()
            .setColor(0x9b59b6) // Purple for AI thinking
            .setTitle("🤖 AI-agentens Resonemang")
            .setDescription(this.formatTipContent(thinking))
            .addFields({
                name: "🧠 Kategori",
                value: category.charAt(0).toUpperCase() + category.slice(1),
                inline: true,
            })
            .setFooter({
                text: "AI-powered insights • Gemini 2.5 Pro",
                iconURL:
                    "https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg",
            })
            .setTimestamp();
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
