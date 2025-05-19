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
        "Ge exakt 3 användbara och pedagogiska tips inom frontendutveckling som passar studenter år 2025. " +
        "Tipsen ska vara enkla att förstå och använda, och gärna förklara varför de är viktiga. Undvik avancerade eller alltför tekniska tips. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom frontendutveckling på ett enkelt sätt. Svara utan hälsningsfras. Slumpnummer: " +
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
        "Tipsen ska vara enkla att förstå och använda, och gärna förklara varför de är viktiga. Undvik avancerade eller alltför tekniska tips. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom backendutveckling på ett enkelt sätt. Svara utan hälsningsfras. Slumpnummer: " +
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
        "Ge exakt 3 avancerade eller mindre kända tips, tekniker eller trender inom fullstackutveckling (både frontend och backend) som är relevanta för 2025. " +
        "Undvik vanliga tips som 'använd React', 'använd Node.js', 'responsiv design', 'testa din kod', eller liknande grundläggande råd. " +
        "Fokusera på nya verktyg, tekniker, arbetsflöden eller koncept som få studenter känner till. " +
        "Svara utan hälsningsfras och håll svaret kortfattat. Slumpnummer: " +
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

    // Skicka backend-tips varje dag kl 09:01 (svensk tid)
    cron.schedule(
        "1 9 * * *",
        async () => {
            const channelId = "1373995255971582003";
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const tip = await getAIGeneratedBackendTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                try {
                    channel.send(`🛠️ **Dagens backend-tips:**\n${safeTip}`);
                } catch (err) {
                    console.error("Kunde inte skicka backend-meddelande:", err);
                }
            }
        },
        {
            timezone: "Europe/Stockholm",
        }
    );

    // Skicka fullstack-tips varje dag kl 09:02 (svensk tid)
    cron.schedule(
        "2 9 * * *",
        async () => {
            const channelId = "1373995255971582003";
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const tip = await getAIGeneratedFullstackTip();
                const safeTip =
                    tip.length > MAX_LENGTH
                        ? tip.slice(0, MAX_LENGTH - 3) + "..."
                        : tip;
                try {
                    channel.send(`🌐 **Dagens fullstack-tips:**\n${safeTip}`);
                } catch (err) {
                    console.error(
                        "Kunde inte skicka fullstack-meddelande:",
                        err
                    );
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
