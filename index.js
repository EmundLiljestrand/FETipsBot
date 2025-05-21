import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client, GatewayIntentBits } from "discord.js";
import { MongoClient } from "mongodb";
import cron from "node-cron";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// Shared model instance for all functions
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// MongoDB setup
const mongo = new MongoClient(process.env.MONGODB_URI);
const dbName = "discbot";
// Using a single collection for all tips with a category field
const tipsCollectionName = "all_tips";

// Discord message character limit
const MAX_LENGTH = 2000;

// Connect to MongoDB when the bot starts
let db;
async function connectToMongoDB() {
    try {
        await mongo.connect();
        console.log("Connected to MongoDB");
        db = mongo.db(dbName);
        return true;
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        return false;
    }
}

// Function to add a reflection for a tip
async function addReflection(tip, reflection, category) {
    try {
        await db.collection("agent_reflections").insertOne({
            tip: tip,
            reflection: reflection,
            category: category,
            date: new Date(),
        });
    } catch (error) {
        console.error("Error adding reflection:", error);
    }
}

async function getAIGeneratedTip() {
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge exakt 3 användbara, avancerade och mindre kända tips inom frontendutveckling som passar studenter år 2025. " +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 koncept inom frontendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed;

    let tip = "";
    let tries = 0;
    let normalizedTip = "";

    try {
        do {
            tries++;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 1.5 },
            });
            const response = await result.response;
            tip = response.text();

            // Check if tip already exists in database
            normalizedTip = tip.trim().toLowerCase();
            const exists = await db.collection(tipsCollectionName).findOne({
                text: normalizedTip,
                category: "frontend",
            });

            if (!exists && tip) {
                await db.collection(tipsCollectionName).insertOne({
                    text: normalizedTip,
                    date: new Date(),
                    category: "frontend",
                    difficulty: "avancerad",
                    topics: ["CSS", "JavaScript", "React"],
                    feedback: [],
                });
                break;
            }
        } while (tries < 5);

        // Generate reflection
        const reflectionPrompt =
            `Analysera detta tips som just skickades: "${tip}". ` +
            "Vad var bra med det? Vad kan förbättras nästa gång? " +
            "Vilka ämnen bör täckas nästa gång?";

        const reflectionResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: reflectionPrompt }] }],
        });
        const reflection = reflectionResult.response.text();

        // Save reflection
        await addReflection(normalizedTip, reflection, "frontend");

        return tip || "Tipset kunde inte hämtas just nu.";
    } catch (error) {
        console.error("Error generating frontend tip:", error);
        return "Ett fel uppstod när tipset skulle genereras.";
    }
}

async function getAIGeneratedBackendTip(difficulty = "medel") {
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        `Ge exakt 3 ${difficulty} och pedagogiska tips inom backendutveckling som passar nybörjare eller studenter år 2025. ` +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom backendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed;

    let tip = "";
    let tries = 0;
    let normalizedTip = "";

    try {
        do {
            tries++;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 1.5 },
            });
            const response = await result.response;
            tip = response.text();

            // Check if tip already exists in database
            normalizedTip = tip.trim().toLowerCase();
            const exists = await db.collection(tipsCollectionName).findOne({
                text: normalizedTip,
                category: "backend",
            });

            if (!exists && tip) {
                await db.collection(tipsCollectionName).insertOne({
                    text: normalizedTip,
                    date: new Date(),
                    category: "backend",
                    difficulty: difficulty,
                    topics: ["databaser", "API", "säkerhet"],
                    feedback: [],
                });
                break;
            }
        } while (tries < 5);

        // Generate reflection
        const reflectionPrompt =
            `Analysera detta tips som just skickades: "${tip}". ` +
            "Vad var bra med det? Vad kan förbättras nästa gång? " +
            "Vilka ämnen bör täckas nästa gång?";

        const reflectionResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: reflectionPrompt }] }],
        });
        const reflection = reflectionResult.response.text();

        // Save reflection
        await addReflection(normalizedTip, reflection, "backend");

        return tip || "Tipset kunde inte hämtas just nu.";
    } catch (error) {
        console.error("Error generating backend tip:", error);
        return "Ett fel uppstod när tipset skulle genereras.";
    }
}

async function getAIGeneratedFullstackTip() {
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge exakt 3 tips, tricks, tekniker eller trender inom fullstackutveckling (både frontend och backend) som är relevanta för 2025. " +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom fullstackutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 7 meningar totalt. Slumpnummer: " +
        randomSeed;

    let tip = "";
    let tries = 0;
    let normalizedTip = "";

    try {
        do {
            tries++;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 1.5 },
            });
            const response = await result.response;
            tip = response.text();

            // Check if tip already exists in database
            normalizedTip = tip.trim().toLowerCase();
            const exists = await db.collection(tipsCollectionName).findOne({
                text: normalizedTip,
                category: "fullstack",
            });

            if (!exists && tip) {
                await db.collection(tipsCollectionName).insertOne({
                    text: normalizedTip,
                    date: new Date(),
                    category: "fullstack",
                    difficulty: "medel",
                    topics: ["integration", "skalbarhet", "prestanda"],
                    feedback: [],
                });
                break;
            }
        } while (tries < 5);

        // Generate reflection
        const reflectionPrompt =
            `Analysera detta tips som just skickades: "${tip}". ` +
            "Vad var bra med det? Vad kan förbättras nästa gång? " +
            "Vilka ämnen bör täckas nästa gång?";

        const reflectionResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: reflectionPrompt }] }],
        });
        const reflection = reflectionResult.response.text();

        // Save reflection
        await addReflection(normalizedTip, reflection, "fullstack");

        return tip || "Tipset kunde inte hämtas just nu.";
    } catch (error) {
        console.error("Error generating fullstack tip:", error);
        return "Ett fel uppstod när tipset skulle genereras.";
    }
}

// The AI agent that decides which type of tip to generate
async function getAIAgentTip() {
    try {
        // Get the 5 most recent tips of each type
        const frontendTips = await db
            .collection(tipsCollectionName)
            .find({ category: "frontend" })
            .sort({ date: -1 })
            .limit(5)
            .toArray();
        const backendTips = await db
            .collection(tipsCollectionName)
            .find({ category: "backend" })
            .sort({ date: -1 })
            .limit(5)
            .toArray();
        const fullstackTips = await db
            .collection(tipsCollectionName)
            .find({ category: "fullstack" })
            .sort({ date: -1 })
            .limit(5)
            .toArray();

        // Let AI choose which type of tip is best today
        const selectionPrompt =
            "Du är en intelligent bot som bestämmer vilken typ av programmeringstips som ska ges idag. " +
            "Baserat på de senaste tipsen som getts (se nedan), välj om dagens tips ska vara om FRONTEND, BACKEND eller FULLSTACK. " +
            "Välj den kategori som har fått minst uppmärksamhet nyligen eller som behöver mer variation. " +
            "Svara ENDAST med ett av alternativen: FRONTEND, BACKEND eller FULLSTACK." +
            "\n\nSenaste frontend-tipsen:\n" +
            frontendTips
                .map((t) => `- ${t.text.substring(0, 100)}...`)
                .join("\n") +
            "\n\nSenaste backend-tipsen:\n" +
            backendTips
                .map((t) => `- ${t.text.substring(0, 100)}...`)
                .join("\n") +
            "\n\nSenaste fullstack-tipsen:\n" +
            fullstackTips
                .map((t) => `- ${t.text.substring(0, 100)}...`)
                .join("\n");

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: selectionPrompt }] }],
        });
        const category = result.response.text().trim().toUpperCase();

        // Have AI think about the decision
        const thinkingPrompt =
            "Du är en AI-agent som ansvarar för att välja och generera programmeringstips. " +
            "Analysera följande tips från de senaste dagarna och resonera om: " +
            "1. Vilken kategori behöver mer uppmärksamhet? " +
            "2. Vilka ämnen har täckts nyligen och bör undvikas? " +
            "3. Vilken svårighetsgrad bör dagens tips ha? " +
            "Svara endast med ditt resonemang.";

        const thinkingResult = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: thinkingPrompt }] }],
        });
        const agentThinking = thinkingResult.response.text().trim();

        // Determine difficulty based on AI's thinking
        let difficulty = "medel"; // Default
        if (agentThinking.toLowerCase().includes("nybörjare")) {
            difficulty = "nybörjare";
        } else if (agentThinking.toLowerCase().includes("avancerad")) {
            difficulty = "avancerad";
        }

        // Generate the appropriate tip based on category and difficulty
        if (category === "BACKEND") {
            return {
                tip: await getAIGeneratedBackendTip(difficulty),
                prefix: `🛠️ **Dagens ${difficulty} backend-tips:**`,
                reasoning: agentThinking,
                thinking: agentThinking,
            };
        } else if (category === "FULLSTACK") {
            return {
                tip: await getAIGeneratedFullstackTip(),
                prefix: "🌐 **Dagens fullstack-tips:**",
                reasoning:
                    "Jag valde fullstack-tips idag för att ge en balanserad bild av både front- och backend.",
                thinking: agentThinking,
            };
        } else {
            // Default to frontend
            return {
                tip: await getAIGeneratedTip(),
                prefix: "💡 **Dagens frontend-tips:**",
                reasoning:
                    "Jag valde frontend-tips idag eftersom det är vad de flesta användarna är intresserade av.",
                thinking: agentThinking,
            };
        }
    } catch (error) {
        console.error("Error in AI agent decision making:", error);
        // Fallback to frontend tips if there's an error
        return {
            tip: await getAIGeneratedTip(),
            prefix: "💡 **Dagens frontend-tips:**",
            reasoning: "Fallback till frontend-tips på grund av ett fel.",
            thinking:
                "Ett fel uppstod vid beslut om vilken typ av tips som ska ges.",
        };
    }
}

// Handle process termination
process.on("SIGINT", async () => {
    try {
        await mongo.close();
        console.log("MongoDB connection closed");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
    } finally {
        process.exit();
    }
});

// Initialize MongoDB connection and set up the bot
async function initialize() {
    const connected = await connectToMongoDB();
    if (!connected) {
        console.error("Failed to connect to MongoDB. Exiting...");
        process.exit(1);
    }

    client.once("ready", () => {
        console.log(`🤖 Bot inloggad som ${client.user.tag}`);

        // Schedule one tip per day at 09:00 (Swedish time)
        cron.schedule(
            "0 9 * * *",
            async () => {
                try {
                    const channelId = "1373995255971582003";
                    const channel = await client.channels.fetch(channelId);
                    if (channel && channel.isTextBased()) {
                        const agentResponse = await getAIAgentTip();
                        const safeTip =
                            agentResponse.tip.length > MAX_LENGTH
                                ? agentResponse.tip.slice(0, MAX_LENGTH - 3) +
                                  "..."
                                : agentResponse.tip;

                        // Only show the tip, not the reasoning/thinking
                        await channel.send(
                            `${agentResponse.prefix}\n${safeTip}`
                        );
                        console.log("Daily tip sent successfully");
                    }
                } catch (err) {
                    console.error("Could not send scheduled message:", err);
                }
            },
            {
                timezone: "Europe/Stockholm",
            }
        );
    });

    client.on("messageCreate", async (message) => {
        // Ignore messages from bots
        if (message.author.bot) return;

        try {
            if (message.content === "!dagens-tips") {
                await message.channel.send("🔍 Genererar tips...");
                const tip = await getAIGeneratedTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                await message.channel.send(
                    `💡 **Dagens frontend-tips:**\n${safeTip}`
                );
            }

            if (message.content === "!backend-tips") {
                await message.channel.send("🔍 Genererar backend-tips...");
                const tip = await getAIGeneratedBackendTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                await message.channel.send(
                    `🛠️ **Dagens backend-tips:**\n${safeTip}`
                );
            }

            if (message.content === "!fullstack-tips") {
                await message.channel.send("🔍 Genererar fullstack-tips...");
                const tip = await getAIGeneratedFullstackTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                await message.channel.send(
                    `🌐 **Dagens fullstack-tips:**\n${safeTip}`
                );
            }

            if (message.content === "!ai-tips") {
                await message.channel.send(
                    "🤖 AI-agenten tänker på vilken typ av tips som behövs..."
                );
                const agentResponse = await getAIAgentTip();
                const safeTip =
                    agentResponse.tip.length > MAX_LENGTH
                        ? agentResponse.tip.slice(0, MAX_LENGTH - 3) + "..."
                        : agentResponse.tip;
                // Only show the tip, not the reasoning/thinking
                await message.channel.send(
                    `${agentResponse.prefix}\n${safeTip}`
                );
            }

            // Add a new command to show AI agent's reasoning (for admin/debug purposes)
            if (message.content === "!ai-reasoning") {
                await message.channel.send(
                    "🤖 AI-agenten analyserar tidigare tips och bestämmer nästa steg..."
                );
                const agentResponse = await getAIAgentTip();
                const safeThinking =
                    agentResponse.thinking.length > MAX_LENGTH
                        ? agentResponse.thinking.slice(0, MAX_LENGTH - 3) +
                          "..."
                        : agentResponse.thinking;
                await message.channel.send(
                    `**AI-agentens resonemang:**\n${safeThinking}`
                );
            }
        } catch (error) {
            console.error("Error handling message:", error);
            message.channel.send(
                "Ett fel uppstod när kommandot skulle bearbetas."
            );
        }
    });

    // Login to Discord
    try {
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error("Failed to log in to Discord:", error);
        process.exit(1);
    }
}

// Start the bot
initialize();
