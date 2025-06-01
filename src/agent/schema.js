/**
 * Schema för programmeringstips-agenten
 * Definierar struktur och capability för AI-agenten
 */

export const AgentSchema = {
    name: "ProgrammingTipsAgent",
    description:
        "En AI-agent som ger anpassade programmeringstips baserat på användarmönster och tidigare tips", // De förmågor agenten har
    capabilities: [
        "generateTips",
        "analyzePastTips",
        "recommendCategory",
        "selfReflect",
    ],

    // Strukturen för olika datatyper
    dataModels: {
        tip: {
            text: { type: "string", required: true },
            category: {
                type: "string",
                enum: ["frontend", "backend", "fullstack"],
                required: true,
            },
            topics: { type: "array", items: { type: "string" } },
            date: { type: "date", default: "Date.now" },
        },

        reflection: {
            tipId: { type: "string", required: true },
            analysis: { type: "string", required: true },
            improvements: { type: "string", required: true },
            nextTopics: { type: "array", items: { type: "string" } },
        },

        agentMemory: {
            recentTips: {
                type: "array",
                items: { type: "object", ref: "tip" },
            },
            userPreferences: { type: "object" },
            reflections: {
                type: "array",
                items: { type: "object", ref: "reflection" },
            },
            categoryStats: { type: "object" },
        },
    }, // Typerna av programmeringstips agenten kan ge
    tipTypes: {
        frontend: {
            topicAreas: [
                "CSS",
                "JavaScript",
                "HTML",
                "React",
                "Vue",
                "Angular",
                "UX/UI",
                "Animering",
                "Prestanda",
                "TypeScript",
                "Accessibility",
                "Mobile-first design",
                "Web Components",
                "Progressive Web Apps",
                "Browser DevTools",
                "Responsive Design",
            ],
        },
        backend: {
            topicAreas: [
                "Databaser",
                "API",
                "Node.js",
                "Express",
                "Authentication",
                "Security",
                "Performance",
                "Testing",
                "Microservices",
                "Caching",
                "Error Handling",
                "Logging",
                "Database Design",
                "REST APIs",
                "GraphQL",
                "Serverless",
            ],
        },
        fullstack: {
            topicAreas: [
                "Integration",
                "Deployment",
                "DevOps",
                "Arkitektur",
                "Authentication",
                "State Management",
                "CI/CD",
                "Docker",
                "Cloud Services",
                "Monitoring",
                "Version Control",
                "Code Review",
                "Project Structure",
                "API Design",
                "Database Migration",
                "Performance Optimization",
            ],
        },
    },
};

export default AgentSchema;
