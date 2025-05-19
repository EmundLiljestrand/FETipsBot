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
    const prompt =
        "Ge exempel på koncept, idéer eller vad som är inne i frontend utvecklare branschen just nu. Riktat mot frontendutvecklar studenter. Skippa hälsningsfrasen. Max 5 tips.";

    const db = mongo.db(dbName);
    const tipsCol = db.collection(collectionName);

    let tip = "";
    let tries = 0;
    do {
        tries++;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        tip = response.text();
        // Kolla om tipset redan finns i databasen
        const exists = await tipsCol.findOne({ text: tip });
        if (!exists && tip) {
            await tipsCol.insertOne({ text: tip, date: new Date() });
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
            const channelId = "1373766004215255063";
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
