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
        "Ge exakt 3 användbara, avancerade och mindre kända tips inom frontendutveckling som passar studenter år 2025. " +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 koncept inom frontendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
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

async function getAIGeneratedBackendTip() {
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge exakt 3 användbara och pedagogiska tips inom backendutveckling som passar nybörjare eller studenter år 2025. " +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom backendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed;

    const db = mongo.db(dbName);
    const tipsCol = db.collection("backend_tips");

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

async function getAIGeneratedFullstackTip() {
    const randomSeed = Math.floor(Math.random() * 100000);
    const prompt =
        "Ge exakt 3 tips, tricks, tekniker eller trender inom fullstackutveckling (både frontend och backend) som är relevanta för 2025. " +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom fullstackutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 7 meningar totalt. Slumpnummer: " +
        randomSeed;

    const db = mongo.db(dbName);
    const tipsCol = db.collection("fullstack_tips");

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

    // Skicka ETT tips varje dag kl 09:00 (svensk tid), roterande mellan typer
    cron.schedule(
        "0 9 * * *",
        async () => {
            const channelId = "1373995255971582003";
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const day = new Date().getDay(); // 0=söndag, 1=måndag, ..., 6=lördag
                let tip, prefix;
                if (day === 1 || day === 4 || day === 0) {
                    // måndag, torsdag, söndag
                    tip = await getAIGeneratedTip();
                    prefix = "💡 **Dagens frontend-tips:**";
                } else if (day === 2 || day === 5) {
                    // tisdag, fredag
                    tip = await getAIGeneratedBackendTip();
                    prefix = "🛠️ **Dagens backend-tips:**";
                } else {
                    // onsdag, lördag
                    tip = await getAIGeneratedFullstackTip();
                    prefix = "🌐 **Dagens fullstack-tips:**";
                }
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                try {
                    channel.send(`${prefix}\n${safeTip}`);
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

    if (message.content === "!backend-tips") {
        await message.channel.send("🔍 Genererar backend-tips...");
        const tip = await getAIGeneratedBackendTip();
        const safeTip =
            tip.length > MAX_LENGTH
                ? tip.slice(0, MAX_LENGTH - 3) + "..."
                : tip;
        message.channel.send(`🛠️ **Dagens backend-tips:**\n${safeTip}`);
    }

    if (message.content === "!fullstack-tips") {
        await message.channel.send("🔍 Genererar fullstack-tips...");
        const tip = await getAIGeneratedFullstackTip();
        const safeTip =
            tip.length > MAX_LENGTH
                ? tip.slice(0, MAX_LENGTH - 3) + "..."
                : tip;
        message.channel.send(`🌐 **Dagens fullstack-tips:**\n${safeTip}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
