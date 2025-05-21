import { AgentSchema } from "./schema.js";
import { generatePrompt } from "../utils/prompt-utils.js";

/**
 * Huvudklassen för ProgrammeringsTips-agenten som hanterar alla AI-funktioner
 */
export class ProgrammingTipsAgent {
    constructor(aiClient, db) {
        this.aiClient = aiClient;
        this.model = aiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
        this.db = db;
        this.schema = AgentSchema;
        this.memory = {
            recentTips: [],
            userPreferences: {},
            reflections: [],
            categoryStats: {
                frontend: { count: 0, lastSent: null },
                backend: { count: 0, lastSent: null },
                fullstack: { count: 0, lastSent: null },
            },
        };
    }

    /**
     * Initialiserar agentens minne med data från databasen
     */
    async initialize() {
        try {
            // Ladda in tidigare tips för att bygga upp agentens kontext
            const tipsCollection = this.db.collection("all_tips");

            // Hämta de senaste tipsen för varje kategori
            this.memory.recentTips = await tipsCollection
                .find()
                .sort({ date: -1 })
                .limit(15)
                .toArray();

            // Hämta tidigare reflektioner
            this.memory.reflections = await this.db
                .collection("agent_reflections")
                .find()
                .sort({ date: -1 })
                .limit(10)
                .toArray();

            // Beräkna statistik för varje kategori
            const categoryStats = await tipsCollection
                .aggregate([
                    {
                        $group: {
                            _id: "$category",
                            count: { $sum: 1 },
                            lastSent: { $max: "$date" },
                        },
                    },
                ])
                .toArray();

            // Uppdatera agentens minne med statistiken
            categoryStats.forEach((stat) => {
                if (this.memory.categoryStats[stat._id]) {
                    this.memory.categoryStats[stat._id].count = stat.count;
                    this.memory.categoryStats[stat._id].lastSent =
                        stat.lastSent;
                }
            });

            console.log(
                "Agent initialized successfully with memory from database"
            );
            return this;
        } catch (error) {
            console.error("Failed to initialize agent:", error);
            throw error;
        }
    }

    /**
     * Analyserar tidigare tips och avgör vilken kategori som bör ges härnäst
     */
    async recommendCategory() {
        try {
            // Preparera data för analys
            const frontendTips = this.memory.recentTips
                .filter((t) => t.category === "frontend")
                .slice(0, 5);
            const backendTips = this.memory.recentTips
                .filter((t) => t.category === "backend")
                .slice(0, 5);
            const fullstackTips = this.memory.recentTips
                .filter((t) => t.category === "fullstack")
                .slice(0, 5);

            // Skapa kontexten för AI-modellen
            const context = {
                frontendTips,
                backendTips,
                fullstackTips,
                categoryStats: this.memory.categoryStats,
            };

            // Generera prompt med hjälp av utility-funktion
            const prompt = generatePrompt("recommendCategory", context);

            // Fråga AI-modellen
            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });

            const category = result.response.text().trim().toUpperCase();

            // Säkerställ att vi får en giltig kategori
            if (!["FRONTEND", "BACKEND", "FULLSTACK"].includes(category)) {
                console.warn(
                    `Invalid category recommendation: ${category}, falling back to FRONTEND`
                );
                return "FRONTEND";
            }

            return category;
        } catch (error) {
            console.error("Error recommending category:", error);
            return "FRONTEND"; // Fallback
        }
    }

    /**
     * Bestämmer svårighetsgrad baserat på tidigare tips och användarmönster
     */
    async determineDifficulty(category) {
        try {
            // Hämta de senaste tipsen av den valda kategorin
            const recentCategoryTips = this.memory.recentTips
                .filter((t) => t.category === category.toLowerCase())
                .slice(0, 7);

            // Använd tidigare reflektioner för att fatta ett bättre beslut
            const relevantReflections = this.memory.reflections
                .filter((r) => r.category === category.toLowerCase())
                .slice(0, 3);

            const context = {
                category,
                recentCategoryTips,
                reflections: relevantReflections,
            };

            // Generera prompt för svårighetsgrad
            const prompt = generatePrompt("determineDifficulty", context);

            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });

            const response = result.response.text().trim().toLowerCase();

            // Extrahera svårighetsgraden från svaret
            if (response.includes("nybörjare")) {
                return "nybörjare";
            } else if (response.includes("avancerad")) {
                return "avancerad";
            } else {
                return "medel";
            }
        } catch (error) {
            console.error("Error determining difficulty:", error);
            return "medel"; // Fallback
        }
    }

    /**
     * Genererar frontend-tips med given svårighetsgrad
     */
    async generateFrontendTip(difficulty = "medel") {
        try {
            const randomSeed = Math.floor(Math.random() * 100000);
            const context = {
                difficulty,
                randomSeed,
                recentTips: this.memory.recentTips
                    .filter((t) => t.category === "frontend")
                    .slice(0, 3),
            };

            const prompt = generatePrompt("frontendTip", context);

            let tip = "";
            let tries = 0;
            let normalizedTip = "";

            // Försök generera ett unikt tips
            do {
                tries++;
                const result = await this.model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 1.5 },
                });

                const response = await result.response;
                tip = response.text();

                // Kolla om tipset redan finns
                normalizedTip = tip.trim().toLowerCase();
                const exists = await this.db.collection("all_tips").findOne({
                    text: normalizedTip,
                    category: "frontend",
                });

                if (!exists && tip) {
                    // Spara tipset i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "frontend",
                        difficulty: difficulty,
                        topics: ["CSS", "JavaScript", "React"],
                        feedback: [],
                    });

                    // Uppdatera agentens minne och statistik
                    this.memory.recentTips.unshift({
                        text: normalizedTip,
                        date: new Date(),
                        category: "frontend",
                        difficulty: difficulty,
                    });

                    this.memory.categoryStats.frontend.count++;
                    this.memory.categoryStats.frontend.lastSent = new Date();

                    break;
                }
            } while (tries < 5);

            // Skapa reflektion om tipset
            await this.selfReflect(tip, "frontend");

            return (
                tip || "Kunde inte generera ett unikt frontend-tips just nu."
            );
        } catch (error) {
            console.error("Error generating frontend tip:", error);
            return "Ett fel uppstod när frontend-tipset skulle genereras.";
        }
    }

    /**
     * Genererar backend-tips med given svårighetsgrad
     */
    async generateBackendTip(difficulty = "medel") {
        try {
            const randomSeed = Math.floor(Math.random() * 100000);
            const context = {
                difficulty,
                randomSeed,
                recentTips: this.memory.recentTips
                    .filter((t) => t.category === "backend")
                    .slice(0, 3),
            };

            const prompt = generatePrompt("backendTip", context);

            let tip = "";
            let tries = 0;
            let normalizedTip = "";

            // Försök generera ett unikt tips
            do {
                tries++;
                const result = await this.model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 1.5 },
                });

                const response = await result.response;
                tip = response.text();

                // Kolla om tipset redan finns
                normalizedTip = tip.trim().toLowerCase();
                const exists = await this.db.collection("all_tips").findOne({
                    text: normalizedTip,
                    category: "backend",
                });

                if (!exists && tip) {
                    // Spara tipset i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "backend",
                        difficulty: difficulty,
                        topics: ["databaser", "API", "säkerhet"],
                        feedback: [],
                    });

                    // Uppdatera agentens minne och statistik
                    this.memory.recentTips.unshift({
                        text: normalizedTip,
                        date: new Date(),
                        category: "backend",
                        difficulty: difficulty,
                    });

                    this.memory.categoryStats.backend.count++;
                    this.memory.categoryStats.backend.lastSent = new Date();

                    break;
                }
            } while (tries < 5);

            // Skapa reflektion om tipset
            await this.selfReflect(tip, "backend");

            return tip || "Kunde inte generera ett unikt backend-tips just nu.";
        } catch (error) {
            console.error("Error generating backend tip:", error);
            return "Ett fel uppstod när backend-tipset skulle genereras.";
        }
    }

    /**
     * Genererar fullstack-tips
     */
    async generateFullstackTip(difficulty = "medel") {
        try {
            const randomSeed = Math.floor(Math.random() * 100000);
            const context = {
                difficulty,
                randomSeed,
                recentTips: this.memory.recentTips
                    .filter((t) => t.category === "fullstack")
                    .slice(0, 3),
            };

            const prompt = generatePrompt("fullstackTip", context);

            let tip = "";
            let tries = 0;
            let normalizedTip = "";

            // Försök generera ett unikt tips
            do {
                tries++;
                const result = await this.model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 1.5 },
                });

                const response = await result.response;
                tip = response.text();

                // Kolla om tipset redan finns
                normalizedTip = tip.trim().toLowerCase();
                const exists = await this.db.collection("all_tips").findOne({
                    text: normalizedTip,
                    category: "fullstack",
                });

                if (!exists && tip) {
                    // Spara tipset i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "fullstack",
                        difficulty: difficulty,
                        topics: ["integration", "skalbarhet", "prestanda"],
                        feedback: [],
                    });

                    // Uppdatera agentens minne och statistik
                    this.memory.recentTips.unshift({
                        text: normalizedTip,
                        date: new Date(),
                        category: "fullstack",
                        difficulty: difficulty,
                    });

                    this.memory.categoryStats.fullstack.count++;
                    this.memory.categoryStats.fullstack.lastSent = new Date();

                    break;
                }
            } while (tries < 5);

            // Skapa reflektion om tipset
            await this.selfReflect(tip, "fullstack");

            return (
                tip || "Kunde inte generera ett unikt fullstack-tips just nu."
            );
        } catch (error) {
            console.error("Error generating fullstack tip:", error);
            return "Ett fel uppstod när fullstack-tipset skulle genereras.";
        }
    }

    /**
     * Självreflektera över det genererade tipset och spara reflektionen
     */
    async selfReflect(tip, category) {
        try {
            // Generera prompt för reflektion
            const reflectionPrompt =
                `Analysera detta ${category}-tips som just skickades: "${tip}". ` +
                "Vad var bra med det? Vad kan förbättras nästa gång? " +
                "Vilka ämnen bör täckas nästa gång?";

            const reflectionResult = await this.model.generateContent({
                contents: [
                    { role: "user", parts: [{ text: reflectionPrompt }] },
                ],
            });

            const reflection = reflectionResult.response.text();

            // Spara reflektionen i databasen
            await this.db.collection("agent_reflections").insertOne({
                tip: tip.trim().toLowerCase(),
                reflection: reflection,
                category: category,
                date: new Date(),
            });

            // Uppdatera agentens minne med den nya reflektionen
            this.memory.reflections.unshift({
                tip: tip.trim().toLowerCase(),
                reflection: reflection,
                category: category,
                date: new Date(),
            });

            return reflection;
        } catch (error) {
            console.error("Error during self-reflection:", error);
            return "Kunde inte genomföra reflektion.";
        }
    }

    /**
     * Genererar endast ett resonemang baserat på tidigare tips utan att skapa nya tips
     */
    async getAgentReasoning() {
        try {
            // Hämta de senaste tips av varje kategori
            const frontendTips = this.memory.recentTips
                .filter((t) => t.category === "frontend")
                .slice(0, 3);
            const backendTips = this.memory.recentTips
                .filter((t) => t.category === "backend")
                .slice(0, 3);
            const fullstackTips = this.memory.recentTips
                .filter((t) => t.category === "fullstack")
                .slice(0, 3);

            // Utför en quick-analys av vilken kategori som är mest lämplig just nu
            // utan att faktiskt generera tips
            const prompt =
                "Du är en AI-agent som analyserar tipshistorik. " +
                "Baserat på de senaste tipsen nedan, vilken kategori (FRONTEND, BACKEND, FULLSTACK) " +
                "bör fokuseras på härnäst för bästa variation, och med vilken svårighetsgrad (nybörjare, medel, avancerad)? " +
                "Förklara ditt resonemang om: \n" +
                "1. Vilken kategori bör få mer fokus baserat på historiken? \n" +
                "2. Vilken svårighetsgrad är lämplig? \n" +
                "3. Hur kan framtida tips förbättras? \n\n" +
                "Senaste frontend tips: " +
                (frontendTips.length
                    ? frontendTips
                          .map((t) => t.text.substring(0, 100))
                          .join("\n")
                    : "Inga") +
                "\n\n" +
                "Senaste backend tips: " +
                (backendTips.length
                    ? backendTips
                          .map((t) => t.text.substring(0, 100))
                          .join("\n")
                    : "Inga") +
                "\n\n" +
                "Senaste fullstack tips: " +
                (fullstackTips.length
                    ? fullstackTips
                          .map((t) => t.text.substring(0, 100))
                          .join("\n")
                    : "Inga");

            const result = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            });

            const thinking = result.response.text().trim();

            // Extrahera kategorirekommendation från svaret
            let category = "FRONTEND"; // default
            if (thinking.toUpperCase().includes("BACKEND")) {
                category = "BACKEND";
            } else if (thinking.toUpperCase().includes("FULLSTACK")) {
                category = "FULLSTACK";
            }

            // Extrahera svårighetsgrad från svaret
            let difficulty = "medel"; // default
            if (thinking.toLowerCase().includes("nybörjare")) {
                difficulty = "nybörjare";
            } else if (thinking.toLowerCase().includes("avancerad")) {
                difficulty = "avancerad";
            }

            // Bestäm prefix baserat på kategori
            let prefix;
            if (category === "BACKEND") {
                prefix = `🛠️ **Dagens ${difficulty} backend-tips:**`;
            } else if (category === "FULLSTACK") {
                prefix = "🌐 **Dagens fullstack-tips:**";
            } else {
                prefix = `💡 **Dagens ${difficulty} frontend-tips:**`;
            }

            // Returnera bara metadata utan att generera ett nytt tips
            return {
                tip: "", // Inget tips, bara reasoning
                prefix: prefix,
                category: category.toLowerCase(),
                difficulty: difficulty,
                thinking: thinking,
            };
        } catch (error) {
            console.error("Error getting agent reasoning:", error);
            return {
                tip: "",
                prefix: "💡 **Dagens frontend-tips:**",
                category: "frontend",
                difficulty: "medel",
                thinking: "Ett fel uppstod vid analys av tidigare tips.",
            };
        }
    }

    /**
     * Huvud-metoden som orkestrerar alla agentens funktioner för att generera dagens tips
     */
    async generateDailyTip() {
        try {
            // 1. Bestäm vilken kategori som passar bäst baserat på historik
            const category = await this.recommendCategory();
            console.log(`Agent recommends category: ${category}`);

            // 2. Bestäm lämplig svårighetsgrad
            const difficulty = await this.determineDifficulty(category);
            console.log(`Agent recommends difficulty: ${difficulty}`);

            let tip, prefix;

            // 3. Generera tipset i vald kategori och svårighetsgrad
            if (category === "BACKEND") {
                tip = await this.generateBackendTip(difficulty);
                prefix = `🛠️ **Dagens ${difficulty} backend-tips:**`;
            } else if (category === "FULLSTACK") {
                tip = await this.generateFullstackTip(difficulty);
                prefix = "🌐 **Dagens fullstack-tips:**";
            } else {
                // Default till frontend
                tip = await this.generateFrontendTip(difficulty);
                prefix = `💡 **Dagens ${difficulty} frontend-tips:**`;
            }

            // 4. Generera agentens förklaring av sitt tänkande
            const thinkingPrompt =
                "Du är en AI-agent som ansvarar för att välja och generera programmeringstips. " +
                `Du valde just kategorin ${category} med svårighetsgraden ${difficulty}. ` +
                "Förklara ditt resonemang om: " +
                "1. Varför du valde denna kategori? " +
                "2. Varför är denna svårighetsgrad lämplig? " +
                "3. Vad är nästa steg för att förbättra framtida tips?";

            const thinkingResult = await this.model.generateContent({
                contents: [{ role: "user", parts: [{ text: thinkingPrompt }] }],
            });

            const agentThinking = thinkingResult.response.text().trim();

            // 5. Returnera tipset med metadata
            return {
                tip,
                prefix,
                category: category.toLowerCase(),
                difficulty,
                thinking: agentThinking,
            };
        } catch (error) {
            console.error("Error in AI agent decision making:", error);
            // Fallback till frontend-tips
            return {
                tip: await this.generateFrontendTip("medel"),
                prefix: "💡 **Dagens frontend-tips:**",
                category: "frontend",
                difficulty: "medel",
                thinking:
                    "Ett fel uppstod vid beslut om vilken typ av tips som ska ges.",
            };
        }
    }
}

export default ProgrammingTipsAgent;
