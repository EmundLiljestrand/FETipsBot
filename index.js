import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client, GatewayIntentBits } from "discord.js";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function getAIGeneratedTip() {
    const prompt =
        "Ge exempel på koncept, idéer eller vad som är inne i frontend utvecklare branschen just nu. Riktat mot frontendutvecklar studenter. Max 3 meningar.";

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return text || "Tipset kunde inte hämtas just nu.";
    } catch (error) {
        console.error("Gemini API-fel:", error.message);
        return "❌ Kunde inte hämta tips från AI just nu.";
    }
}

client.once("ready", () => {
    console.log(`🤖 Bot inloggad som ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content === "!dagens-tips") {
        await message.channel.send("🔍 Genererar tips...");
        const tip = await getAIGeneratedTip();
        message.channel.send(`💡 **Dagens frontend-tips:**\n${tip}`);
    }
});

client.login(process.env.DISCORD_TOKEN);
