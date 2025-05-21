import { AgentSchema } from "./schema.js";
import { generatePrompt } from "../utils/prompt-utils.js";

/**
 * Huvudklassen för ProgrammeringsTips-agenten som hanterar alla AI-funktioner
 */
export class ProgrammingTipsAgent {
    constructor(aiClient, db) {
        this.aiClient = aiClient;
        // Initialisera primär modell för generering (Gemini 2.0)
        this.generatorModel = aiClient.getGenerativeModel({
            model: "gemini-2.0-flash",
        });
        // Initialisera sekundär modell för verifiering (Gemini 2.5)
        this.verifierModel = aiClient.getGenerativeModel({
            model: "gemini-2.5-flash-preview-05-20",
        });
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
            }; // Generera prompt med hjälp av utility-funktion
            const prompt = generatePrompt("recommendCategory", context);

            // Fråga AI-modellen
            const result = await this.generatorModel.generateContent({
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
            }; // Generera prompt för svårighetsgrad
            const prompt = generatePrompt("determineDifficulty", context);

            const result = await this.generatorModel.generateContent({
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
            let isApproved = false;
            let verificationResult = {};

            // Försök generera ett unikt tips
            do {
                tries++;
                if (tries > 1) {
                    console.log(
                        `Försök ${tries} att generera frontend-tips...`
                    );
                }

                const result = await this.generatorModel.generateContent({
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
                    // Verifiera tipset med Gemini 2.5
                    verificationResult = await this.verifyTipQuality(
                        tip,
                        "frontend",
                        difficulty
                    );
                    isApproved = verificationResult.approved;

                    if (!isApproved) {
                        console.log(
                            `Frontend-tips avvisat: ${verificationResult.reason}`
                        );
                        continue;
                    }

                    // Tipset godkänt - spara i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "frontend",
                        difficulty: difficulty,
                        topics: ["CSS", "JavaScript", "React"],
                        feedback: [],
                        verificationScore: verificationResult.score || 0,
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
            let isApproved = false;
            let verificationResult = {};

            // Försök generera ett unikt tips
            do {
                tries++;
                if (tries > 1) {
                    console.log(`Försök ${tries} att generera backend-tips...`);
                }

                const result = await this.generatorModel.generateContent({
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
                    // Verifiera tipset med Gemini 2.5
                    verificationResult = await this.verifyTipQuality(
                        tip,
                        "backend",
                        difficulty
                    );
                    isApproved = verificationResult.approved;

                    if (!isApproved) {
                        console.log(
                            `Backend-tips avvisat: ${verificationResult.reason}`
                        );
                        continue;
                    }

                    // Tipset godkänt - spara i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "backend",
                        difficulty: difficulty,
                        topics: ["databaser", "API", "säkerhet"],
                        feedback: [],
                        verificationScore: verificationResult.score || 0,
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
            let isApproved = false;
            let verificationResult = {};

            // Försök generera ett unikt tips
            do {
                tries++;
                if (tries > 1) {
                    console.log(
                        `Försök ${tries} att generera fullstack-tips...`
                    );
                }

                const result = await this.generatorModel.generateContent({
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
                    // Verifiera tipset med Gemini 2.5
                    verificationResult = await this.verifyTipQuality(
                        tip,
                        "fullstack",
                        difficulty
                    );
                    isApproved = verificationResult.approved;

                    if (!isApproved) {
                        console.log(
                            `Fullstack-tips avvisat: ${verificationResult.reason}`
                        );
                        continue;
                    }

                    // Tipset godkänt - spara i databasen
                    await this.db.collection("all_tips").insertOne({
                        text: normalizedTip,
                        date: new Date(),
                        category: "fullstack",
                        difficulty: difficulty,
                        topics: ["integration", "skalbarhet", "prestanda"],
                        feedback: [],
                        verificationScore: verificationResult.score || 0,
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

            const reflectionResult = await this.generatorModel.generateContent({
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
     * Verifierar kvalitet och unikhet på ett genererat tips med den avancerade Gemini 2.5 modellen
     * @param {string} tip - Tipset som ska verifieras
     * @param {string} category - Kategorin (frontend, backend, fullstack)
     * @param {string} difficulty - Svårighetsgraden (nybörjare, medel, avancerad)
     * @returns {Promise<{approved: boolean, reason: string, score: number}>}
     */
    async verifyTipQuality(tip, category, difficulty) {
        try {
            // Hämta de senaste tipsen för jämförelse
            const previousTips = this.memory.recentTips
                .filter((t) => t.category === category)
                .slice(0, 5)
                .map((t) => t.text);

            const verificationPrompt = `Du är en granskare för programmeringstips inom ${category}-utveckling. 
                Din uppgift är att utvärdera om följande tips är lämpligt att skicka till våra användare:
                
                NYTT TIPS:
                """
                ${tip}
                """
                
                Tidigare tips inom samma kategori:
                ${previousTips.map((t, i) => `${i + 1}. ${t}`).join("\n")}
                
                Svårighetsgrad: ${difficulty}
                
                Bedöm tipset enligt följande kriterier på en skala 1-10:
                1. UNIKHET: Är tipset tillräckligt annorlunda från tidigare tips? (1 = duplikat, 10 = helt ny information)
                2. RELEVANS: Är tipset relevant för ${category}-utvecklare år 2025? (1 = irrelevant, 10 = mycket relevant)
                3. KORREKTHET: Är innehållet tekniskt korrekt? (1 = felaktigt, 10 = helt korrekt)
                4. SVÅRIGHETSNIVÅ: Motsvarar svårighetsgraden "${difficulty}"? (1 = helt fel nivå, 10 = perfekt nivå)
                
                Svara ENDAST med ett JSON-objekt med följande format:
                {
                    "uniqueness": x,
                    "relevance": x,
                    "correctness": x,
                    "difficulty_match": x,
                    "total_score": x,
                    "approved": true/false,
                    "reason": "kort förklaring till beslutet"
                }`;

            const result = await this.verifierModel.generateContent({
                contents: [
                    { role: "user", parts: [{ text: verificationPrompt }] },
                ],
            });

            const responseText = result.response.text().trim();

            try {
                // Försök tolka svaret som JSON
                const assessment = JSON.parse(responseText);
                console.log(
                    `Tip verification results: ${JSON.stringify(assessment)}`
                );

                // Godkänn tipset om totalpoängen är 7 eller högre, eller om approved är true
                return {
                    approved:
                        assessment.approved === undefined
                            ? assessment.total_score >= 7
                            : assessment.approved,
                    reason: assessment.reason || "Ingen motivering tillgänglig",
                    score: assessment.total_score || 0,
                };
            } catch (jsonError) {
                console.warn(
                    "Failed to parse verification result as JSON:",
                    jsonError
                );
                console.log("Raw response:", responseText);
                // Om JSON-tolkning misslyckas, utgå från att det är OK (fallback)
                return {
                    approved: true,
                    reason: "Kunde inte tolka verifieringssvaret",
                    score: 0,
                };
            }
        } catch (error) {
            console.error("Error in tip verification:", error);
            // Vid fel, låt tipset gå igenom
            return {
                approved: true,
                reason: "Ett fel uppstod vid verifiering",
                score: 0,
            };
        }
    }
    /**
     * Huvud-metoden som orkestrerar alla agentens funktioner för att generera dagens tips
     */
    async generateDailyTip() {
        try {
            // 1. Slumpmässigt val av kategori (frontend, backend, fullstack)
            const categories = ["FRONTEND", "BACKEND", "FULLSTACK"];
            const category =
                categories[Math.floor(Math.random() * categories.length)];
            console.log(`Random category selected: ${category}`);

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
            } // 4. Generera agentens förklaring av sitt tänkande
            const thinkingPrompt =
                "Du är en AI-agent som ansvarar för att generera programmeringstips. " +
                `En slumpmässigt vald kategori blev ${category} med svårighetsgraden ${difficulty}. ` +
                "Förklara vad som är intressant med denna kategori och: " +
                "1. Varför denna svårighetsgrad kan vara lämplig? " +
                "2. Vilka typer av koncept som kan vara lärorika inom denna kategori? " +
                "3. Vad är nästa steg för att förbättra framtida tips?";

            const thinkingResult = await this.generatorModel.generateContent({
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
