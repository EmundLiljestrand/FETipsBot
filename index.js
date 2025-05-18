import dotenv from "dotenv";
import axios from "axios";
import { Client, GatewayIntentBits } from "discord.js";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const MODEL = "mistralai/Mistral-7B-Instruct-v0.1";

async function getAIGeneratedTip() {
    const prompt =
        "Ge exempel på koncept, idéer eller vad som är inne i frontend utvecklare branschen just nu. Riktat mot frontendutvecklar studenter. Max 3 meningar.";

    try {
        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${MODEL}`,
            { inputs: prompt },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HF_API_KEY}`,
                },
            }
        );

        const generated =
            response.data?.[0]?.generated_text ||
            "Tipset kunde inte hämtas just nu.";
        return generated.replace(prompt, "").trim();
    } catch (error) {
        console.error("HF API-fel:", error.message);
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
