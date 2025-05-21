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

// Ny funktion som låter AI:n välja vilket tips som bör ges
async function getAIAgentTip() {
    const db = mongo.db(dbName);

    // Hämta de 5 senaste tipsen av varje typ
    const frontendTips = await db
        .collection(collectionName)
        .find()
        .sort({ date: -1 })
        .limit(5)
        .toArray();
    const backendTips = await db
        .collection("backend_tips")
        .find()
        .sort({ date: -1 })
        .limit(5)
        .toArray();
    const fullstackTips = await db
        .collection("fullstack_tips")
        .find()
        .sort({ date: -1 })
        .limit(5)
        .toArray();

    // Låt AI:n själv välja vilken typ av tips som passar bäst idag
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const selectionPrompt =
        "Du är en intelligent bot som bestämmer vilken typ av programmeringstips som ska ges idag. " +
        "Baserat på de senaste tipsen som getts (se nedan), välj om dagens tips ska vara om FRONTEND, BACKEND eller FULLSTACK. " +
        "Välj den kategori som har fått minst uppmärksamhet nyligen eller som behöver mer variation. " +
        "Svara ENDAST med ett av alternativen: FRONTEND, BACKEND eller FULLSTACK." +
        "\n\nSenaste frontend-tipsen:\n" +
        frontendTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n") +
        "\n\nSenaste backend-tipsen:\n" +
        backendTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n") +
        "\n\nSenaste fullstack-tipsen:\n" +
        fullstackTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n");

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: selectionPrompt }] }],
    });
    const category = result.response.text().trim().toUpperCase();

    // Välj rätt tipsfunktion baserat på AI:ns val
    if (category === "BACKEND") {
        return {
            tip: await getAIGeneratedBackendTip(),
            prefix: "🛠️ **Dagens backend-tips:**",
            reasoning:
                "Jag valde backend-tips idag eftersom de senaste tipsen fokuserat mer på frontend.",
        };
    } else if (category === "FULLSTACK") {
        return {
            tip: await getAIGeneratedFullstackTip(),
            prefix: "🌐 **Dagens fullstack-tips:**",
            reasoning:
                "Jag valde fullstack-tips idag för att ge en balanserad bild av både front- och backend.",
        };
    } else {
        // Default till frontend
        return {
            tip: await getAIGeneratedTip(),
            prefix: "💡 **Dagens frontend-tips:**",
            reasoning:
                "Jag valde frontend-tips idag eftersom det är vad de flesta användarna är intresserade av.",
        };
    }
}

// Stäng anslutningen när processen avslutas
process.on("SIGINT", async () => {
    await mongo.close();
    process.exit();
});

const MAX_LENGTH = 2000;

client.once("ready", () => {
    console.log(`🤖 Bot inloggad som ${client.user.tag}`);

    // Skicka ETT tips varje dag kl 09:00 (svensk tid), låt AI:n välja typ
    cron.schedule(
        "0 9 * * *",
        async () => {
            const channelId = "1373995255971582003";
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const agentResponse = await getAIAgentTip();
                const safeTip =
                    agentResponse.tip.length > MAX_LENGTH
                        ? agentResponse.tip.slice(0, MAX_LENGTH - 3) + "..."
                        : agentResponse.tip;
                try {
                    // Inkludera AI:ns resonemang för ökad transparens
                    channel.send(
                        `${agentResponse.prefix}\n${safeTip}\n\n_${agentResponse.reasoning}_`
                    );
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

    if (message.content === "!ai-tips") {
        await message.channel.send(
            "🤖 AI-agenten tänker på vilken typ av tips som behövs..."
        );
        const agentResponse = await getAIAgentTip();
        const safeTip =
            agentResponse.tip.length > MAX_LENGTH
                ? agentResponse.tip.slice(0, MAX_LENGTH - 3) + "..."
                : agentResponse.tip;
        message.channel.send(
            `${agentResponse.prefix}\n${safeTip}\n\n_${agentResponse.reasoning}_`
        );
    }
});

client.login(process.env.DISCORD_TOKEN);
