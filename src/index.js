import dotenv from "dotenv";
import { Application } from "./app.js";
import { config } from "./config.js";

// Ladda miljövariabler
dotenv.config();

// Samla inloggningsuppgifter från miljövariabler
const credentials = {
    discordToken: process.env.DISCORD_TOKEN,
    googleApiKey: process.env.GOOGLE_API_KEY,
    mongoUri: process.env.MONGODB_URI,
};

// Kontrollera att alla nödvändiga credentials finns
const checkCredentials = () => {
    const missing = Object.entries(credentials)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missing.length) {
        console.error(
            `Missing required environment variables: ${missing.join(", ")}`
        );
        console.error("Please check your .env file");
        return false;
    }

    return true;
};

/**
 * Startar applikationen
 */
async function startApp() {
    try {
        // Kontrollera credentials
        if (!checkCredentials()) {
            process.exit(1);
        }

        // Skapa och initialisera applikationen
        const app = new Application(config);
        const initialized = await app.initialize(credentials);

        if (!initialized) {
            console.error("Failed to initialize application, exiting...");
            process.exit(1);
        }

        console.log("AI Tips Bot running!");

        // Hantera nedstängning
        const handleShutdown = async (signal) => {
            console.log(`\nReceived ${signal}. Shutting down...`);
            await app.shutdown();
            process.exit(0);
        };

        // Registrera signal handlers
        process.on("SIGINT", () => handleShutdown("SIGINT"));
        process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    } catch (error) {
        console.error("Unexpected error:", error);
        process.exit(1);
    }
}

// Starta applikationen
startApp();
