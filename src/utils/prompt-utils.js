/**
 * Utility-funktioner för att generera AI-prompts
 */

/**
 * Genererar en lämplig prompt baserat på typ och kontext
 * @param {string} type - Typ av prompt att generera
 * @param {Object} context - Kontext data att använda i prompten
 * @returns {string} - Genererad prompt
 */
export function generatePrompt(type, context) {
    switch (type) {
        case "recommendCategory":
            return generateCategoryRecommendationPrompt(context);
        case "determineDifficulty":
            return generateDifficultyPrompt(context);
        case "frontendTip":
            return generateFrontendTipPrompt(context);
        case "backendTip":
            return generateBackendTipPrompt(context);
        case "fullstackTip":
            return generateFullstackTipPrompt(context);
        default:
            throw new Error(`Unknown prompt type: ${type}`);
    }
}

/**
 * Genererar prompt för att välja lämplig kategori
 */
function generateCategoryRecommendationPrompt({
    frontendTips,
    backendTips,
    fullstackTips,
    categoryStats,
}) {
    return (
        "Du är en intelligent bot som bestämmer vilken typ av programmeringstips som ska ges idag. " +
        "Baserat på de senaste tipsen som getts (se nedan) och hur ofta varje kategori förekommer, " +
        "välj om dagens tips ska vara om FRONTEND, BACKEND eller FULLSTACK. " +
        "Välj den kategori som har fått minst uppmärksamhet nyligen eller som behöver mer variation. " +
        "Svara ENDAST med ett av alternativen: FRONTEND, BACKEND eller FULLSTACK." +
        "\n\nKategoristatistik:" +
        `\nFrontend: ${categoryStats.frontend.count} tips (senast: ${
            categoryStats.frontend.lastSent
                ? new Date(categoryStats.frontend.lastSent).toLocaleDateString()
                : "aldrig"
        })` +
        `\nBackend: ${categoryStats.backend.count} tips (senast: ${
            categoryStats.backend.lastSent
                ? new Date(categoryStats.backend.lastSent).toLocaleDateString()
                : "aldrig"
        })` +
        `\nFullstack: ${categoryStats.fullstack.count} tips (senast: ${
            categoryStats.fullstack.lastSent
                ? new Date(
                      categoryStats.fullstack.lastSent
                  ).toLocaleDateString()
                : "aldrig"
        })` +
        "\n\nSenaste frontend-tipsen:\n" +
        frontendTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n") +
        "\n\nSenaste backend-tipsen:\n" +
        backendTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n") +
        "\n\nSenaste fullstack-tipsen:\n" +
        fullstackTips.map((t) => `- ${t.text.substring(0, 100)}...`).join("\n")
    );
}

/**
 * Genererar prompt för att bestämma svårighetsgrad
 */
function generateDifficultyPrompt({
    category,
    recentCategoryTips,
    reflections,
}) {
    return (
        `Du är en AI-agent som ansvarar för att välja svårighetsgrad för ${category.toLowerCase()}-tips. ` +
        "Baserat på tidigare tips och reflektioner, välj om dagens tips ska vara för " +
        "NYBÖRJARE, MEDEL eller AVANCERAD nivå. " +
        "Försök variera svårighetsgrad över tid, men också ta hänsyn till vad som verkar fungera bäst. " +
        "\n\nSenaste tips i denna kategori:\n" +
        recentCategoryTips
            .map((t) => `- ${t.difficulty}: ${t.text.substring(0, 100)}...`)
            .join("\n") +
        "\n\nTidigare reflektioner:\n" +
        reflections
            .map((r) => `- ${r.reflection.substring(0, 100)}...`)
            .join("\n") +
        "\n\nSvara ENDAST med ett av alternativen: NYBÖRJARE, MEDEL eller AVANCERAD."
    );
}

/**
 * Genererar prompt för frontend-tips
 */
function generateFrontendTipPrompt({ difficulty, randomSeed, recentTips }) {
    // Analysera tidigare tips för att undvika att upprepa liknande ämnen
    const recentTopics = recentTips.map((tip) => {
        // Försök identifiera huvudämnet i tipset
        const lowerText = tip.text.toLowerCase();
        if (lowerText.includes("css")) return "CSS";
        if (lowerText.includes("javascript") || lowerText.includes("js"))
            return "JavaScript";
        if (lowerText.includes("react")) return "React";
        if (lowerText.includes("vue")) return "Vue";
        if (lowerText.includes("angular")) return "Angular";
        return "Annat";
    });

    // Undvik att upprepa samma ämne
    let avoidTopics = "";
    if (recentTopics.includes("CSS")) {
        avoidTopics +=
            "Undvik CSS-relaterade tips om möjligt eftersom de nyligen täckts. ";
    }
    if (recentTopics.includes("React")) {
        avoidTopics +=
            "Undvik React-specifika tips om möjligt eftersom de nyligen täckts. ";
    }

    return (
        `Ge exakt 3 användbara, ${difficulty} och mindre kända tips inom frontendutveckling som passar studenter år 2025. ` +
        `${avoidTopics}` +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 koncept inom frontendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed
    );
}

/**
 * Genererar prompt för backend-tips
 */
function generateBackendTipPrompt({ difficulty, randomSeed, recentTips }) {
    // Analysera tidigare tips för att undvika att upprepa liknande ämnen
    const recentTopics = recentTips.map((tip) => {
        const lowerText = tip.text.toLowerCase();
        if (lowerText.includes("databas")) return "Databaser";
        if (lowerText.includes("api")) return "API";
        if (lowerText.includes("säkerhet") || lowerText.includes("security"))
            return "Säkerhet";
        if (lowerText.includes("node")) return "Node.js";
        return "Annat";
    });

    // Undvik att upprepa samma ämne
    let avoidTopics = "";
    if (recentTopics.includes("Databaser")) {
        avoidTopics +=
            "Undvik databas-relaterade tips om möjligt eftersom de nyligen täckts. ";
    }
    if (recentTopics.includes("API")) {
        avoidTopics +=
            "Undvik API-specifika tips om möjligt eftersom de nyligen täckts. ";
    }

    return (
        `Ge exakt 3 ${difficulty} och pedagogiska tips inom backendutveckling som passar nybörjare eller studenter år 2025. ` +
        `${avoidTopics}` +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom backendutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed
    );
}

/**
 * Genererar prompt för fullstack-tips
 */
function generateFullstackTipPrompt({ difficulty, randomSeed, recentTips }) {
    // Analysera tidigare tips
    const recentTopics = recentTips.map((tip) => {
        const lowerText = tip.text.toLowerCase();
        if (lowerText.includes("integration")) return "Integration";
        if (lowerText.includes("skalbar")) return "Skalbarhet";
        if (
            lowerText.includes("prestanda") ||
            lowerText.includes("performance")
        )
            return "Prestanda";
        if (lowerText.includes("deployment") || lowerText.includes("deploy"))
            return "Deployment";
        return "Annat";
    });

    // Undvik att upprepa samma ämne
    let avoidTopics = "";
    if (recentTopics.includes("Integration")) {
        avoidTopics +=
            "Undvik integrations-relaterade tips om möjligt eftersom de nyligen täckts. ";
    }
    if (recentTopics.includes("Prestanda")) {
        avoidTopics +=
            "Undvik prestanda-optimeringstips om möjligt eftersom de nyligen täckts. ";
    }

    return (
        `Ge exakt 3 ${difficulty} tips, tricks, tekniker eller trender inom fullstackutveckling (både frontend och backend) som är relevanta för 2025. ` +
        `${avoidTopics}` +
        "Varje tips ska vara max 2 meningar långt. " +
        "Avsluta med att kort förklara 1 grundläggande koncept inom fullstackutveckling på max 3 meningar. " +
        "Svara utan hälsningsfras och håll hela svaret kortfattat. Max 12 meningar totalt. Slumpnummer: " +
        randomSeed
    );
}

export default { generatePrompt };
