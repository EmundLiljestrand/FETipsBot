import { MongoClient } from "mongodb";

/**
 * Service för att hantera databasoperationer
 */
export class DatabaseService {
    constructor(uri, dbName) {
        this.uri = uri;
        this.dbName = dbName;
        this.client = new MongoClient(uri);
        this.db = null;
        this.isConnected = false;
    }

    /**
     * Ansluter till databasen
     */
    async connect() {
        try {
            await this.client.connect();
            console.log("Connected to MongoDB");

            this.db = this.client.db(this.dbName);
            this.isConnected = true;

            // Se till att nödvändiga collections finns
            await this.ensureCollections();

            return this.db;
        } catch (error) {
            console.error("Failed to connect to MongoDB:", error);
            throw error;
        }
    }

    /**
     * Säkerställer att nödvändiga collections finns
     */
    async ensureCollections() {
        const collections = await this.db.listCollections().toArray();
        const collectionNames = collections.map((c) => c.name);

        // Alla tips i en collection med categoryfield
        if (!collectionNames.includes("all_tips")) {
            await this.db.createCollection("all_tips");

            // Skapa index för effektiva sökningar
            await this.db.collection("all_tips").createIndex({ category: 1 });
            await this.db.collection("all_tips").createIndex({ date: -1 });
            await this.db
                .collection("all_tips")
                .createIndex({ text: 1 }, { unique: true });
        }

        // Collection för reflektioner
        if (!collectionNames.includes("agent_reflections")) {
            await this.db.createCollection("agent_reflections");
            await this.db
                .collection("agent_reflections")
                .createIndex({ date: -1 });
            await this.db
                .collection("agent_reflections")
                .createIndex({ category: 1 });
        }

        // Collection för användarpreferenser och agentens statistik
        if (!collectionNames.includes("agent_stats")) {
            await this.db.createCollection("agent_stats");
        }
    }

    /**
     * Stänger databasanslutningen
     */
    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
            console.log("MongoDB connection closed");
        }
    }

    /**
     * Hjälpmetod för att få en collection
     */
    collection(name) {
        if (!this.isConnected || !this.db) {
            throw new Error("Database not connected");
        }
        return this.db.collection(name);
    }

    /**
     * Sparar ett tips i databasen
     */
    async saveTip(tip) {
        const normalizedTip = {
            ...tip,
            text: tip.text.trim().toLowerCase(),
            date: tip.date || new Date(),
        };

        return await this.collection("all_tips").insertOne(normalizedTip);
    }

    /**
     * Kollar om ett tips finns i databasen
     */
    async tipExists(text, category) {
        const normalizedText = text.trim().toLowerCase();
        const result = await this.collection("all_tips").findOne({
            text: normalizedText,
            category: category,
        });

        return !!result;
    }

    /**
     * Hämtar de senaste tipsen per kategori
     */
    async getRecentTipsByCategory(category, limit = 5) {
        return await this.collection("all_tips")
            .find({ category })
            .sort({ date: -1 })
            .limit(limit)
            .toArray();
    }

    /**
     * Sparar en reflektion i databasen
     */
    async saveReflection(reflection) {
        return await this.collection("agent_reflections").insertOne({
            ...reflection,
            date: reflection.date || new Date(),
        });
    }

    /**
     * Hämtar de senaste reflektionerna
     */
    async getRecentReflections(limit = 10) {
        return await this.collection("agent_reflections")
            .find()
            .sort({ date: -1 })
            .limit(limit)
            .toArray();
    }
}

export default DatabaseService;
