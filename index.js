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

// MongoDB setup
const mongo = new MongoClient(process.env.MONGODB_URI);
const dbName = "discbot";
const collectionName = "tips";

// Anslut till MongoDB en gång när boten startar
await mongo.connect();

async function getAIGeneratedTip() {
    // Lägg till ett slumpmässigt nummer i prompten
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge ett avancerat, mindre känt tips eller trend inom frontendutveckling som är relevant för 2025. Undvik grundläggande saker som React, TypeScript och responsiv design. Fokusera på nya verktyg, tekniker eller arbetsflöden som få känner till. Svara kortfattat men förklarande och utan hälsningsfras. Max 3-4 tips. Slumpnummer: " +
        randomSeed;

    const db = mongo.db(dbName);
    const tipsCol = db.collection(collectionName);

    let tip = "";
    let tries = 0;
    do {
        tries++;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 1.3 },
        });
        const response = await result.response;
        tip = response.text();
        // Kolla om tipset redan finns i databasen
        const normalizedTip = tip.trim().toLowerCase();
        const exists = await tipsCol.findOne({ text: normalizedTip });
        if (!exists && tip) {
            await tipsCol.insertOne({ text: normalizedTip, date: new Date() });
            break;
        }
    } while (tries < 5);

    return tip || "Tipset kunde inte hämtas just nu.";
}

// Stäng anslutningen när processen avslutas
process.on("SIGINT", async () => {
    await mongo.close();
    process.exit();
});

const MAX_LENGTH = 4000;

client.once("ready", () => {
    console.log(`🤖 Bot inloggad som ${client.user.tag}`);

    // Skicka tips varje dag kl 09:00 (svensk tid)
    cron.schedule(
        "0 9 * * *",
        async () => {
            const channelId = "1373995255971582003";
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const tip = await getAIGeneratedTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                try {
                    channel.send(`💡 **Dagens frontend-tips:**\n${safeTip}`);
                } catch (err) {
                    console.error("Kunde inte skicka meddelande:", err);
                }
            }
        },
        {
            timezone: "Europe/Stockholm",
        }
    );
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content === "!dagens-tips") {
        await message.channel.send("🔍 Genererar tips...");
        const tip = await getAIGeneratedTip();
        const safeTip =
            tip.length > MAX_LENGTH
                ? tip.slice(0, MAX_LENGTH - 3) + "..."
                : tip;
        message.channel.send(`💡 **Dagens frontend-tips:**\n${safeTip}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
