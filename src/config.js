/**
 * Centraliserad konfiguration för appen
 */

export const config = {
    // Database settings
    database: {
        dbName: "discbot",
        tipsCollection: "all_tips",
        reflectionsCollection: "agent_reflections",
        statsCollection: "agent_stats",
    },

    // Discord settings
    discord: {
        tipChannelId: "1373995255971582003",
        scheduleTime: "0 9 * * *", // Kl 9:00 varje dag
        timezone: "Europe/Stockholm",
    },

    // AI Agent settings
    agent: {
        defaultDifficulty: "medel",
        maxTipLength: 2000, // Max tecken för Discord
        model: "gemini-2.0-flash",
        temperature: 1.5,
    },

    // Tip types settings
    tipTypes: {
        frontend: {
            emoji: "💡",
            prefix: "Dagens frontend-tips",
            topics: ["CSS", "JavaScript", "React", "Vue", "Angular", "UX/UI"],
        },
        backend: {
            emoji: "🛠️",
            prefix: "Dagens backend-tips",
            topics: ["Databaser", "API", "Node.js", "Express", "Security"],
        },
        fullstack: {
            emoji: "🌐",
            prefix: "Dagens fullstack-tips",
            topics: ["Integration", "Deployment", "DevOps", "Arkitektur"],
        },
    },
};

export default config;
