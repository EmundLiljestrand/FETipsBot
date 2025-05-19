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
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge exakt 3 avancerade eller mindre kända tips, tekniker eller trender inom frontendutveckling som är relevanta för 2025. " +
        "Undvik vanliga tips som 'använd React', 'använd TypeScript', 'responsiv design', 'tillgänglighet', 'semantisk HTML', 'använd Git', 'testa din kod', 'använd CSS-ramverk', eller liknande grundläggande råd. " +
        "Fokusera på nya verktyg, tekniker, arbetsflöden eller koncept som få frontendstudenter känner till. " +
        "Svara utan hälsningsfras och håll svaret kortfattat. Slumpnummer: " +
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
            generationConfig: { temperature: 1.5 },
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

const MAX_LENGTH = 2000;

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
