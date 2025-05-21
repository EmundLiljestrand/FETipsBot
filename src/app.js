import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProgrammingTipsAgent } from "./agent/agent.js";
import { DatabaseService } from "./services/database-service.js";
import { DiscordService } from "./services/discord-service.js";
import { config } from "./config.js";

/**
 * Huvudklass för applikationen som orkestrerar alla tjänster
 */
export class Application {
    constructor(config) {
        this.config = config;

        // Databasen
        this.dbService = null;

        // AI-agenten
        this.genAI = null;
        this.agent = null;

        // Discord-service
        this.discordService = null;
    }

    /**
     * Initialiserar applikationen och alla dess komponenter
     */
    async initialize(credentials) {
        try {
            console.log("Initializing application...");

            // 1. Skapa Google AI-klient
            this.genAI = new GoogleGenerativeAI(credentials.googleApiKey);
            console.log("Google AI client initialized");

            // 2. Anslut till databasen
            this.dbService = new DatabaseService(
                credentials.mongoUri,
                this.config.database.dbName
            );
            const db = await this.dbService.connect();
            console.log("Database service initialized");

            // 3. Skapa och initiera AI-agenten
            this.agent = new ProgrammingTipsAgent(this.genAI, db);
            await this.agent.initialize();
            console.log("AI Agent initialized");

            // 4. Starta Discord-tjänsten
            const discordConfig = {
                channelId: this.config.discord.tipChannelId,
                scheduleTime: this.config.discord.scheduleTime,
                timezone: this.config.discord.timezone,
            };

            this.discordService = new DiscordService(
                credentials.discordToken,
                this.agent,
                discordConfig
            );
            await this.discordService.initialize();
            console.log("Discord service initialized");

            console.log("Application fully initialized!");
            return true;
        } catch (error) {
            console.error("Failed to initialize application:", error);
            await this.shutdown();
            return false;
        }
    }

    /**
     * Stänger ned applikationen och dess komponenter på ett kontrollerat sätt
     */
    async shutdown() {
        console.log("Shutting down application...");

        // Stäng ned alla tjänster i omvänd ordning
        if (this.discordService) {
            await this.discordService.shutdown();
            console.log("Discord service shut down");
        }

        // Databasen stängs sist
        if (this.dbService) {
            await this.dbService.close();
            console.log("Database service shut down");
        }

        console.log("Application shutdown complete");
    }
}

export default Application;
