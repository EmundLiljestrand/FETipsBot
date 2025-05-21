import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Ladda miljövariabler
dotenv.config();

// MongoDB-anslutningssträng
const uri = process.env.MONGODB_URI;
// Databasnamn
const dbName = "discbot";

/**
 * Migrerar data från den gamla strukturen till den nya strukturen
 */
async function migrateData() {
    console.log("Starting data migration...");

    let client;
    try {
        // Anslut till MongoDB
        client = new MongoClient(uri);
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db(dbName);

        // Skapa ny collection om den inte finns
        if (!(await collectionExists(db, "all_tips"))) {
            await db.createCollection("all_tips");
            console.log("Created new collection: all_tips");

            // Skapa index för den nya collectionen
            await db.collection("all_tips").createIndex({ category: 1 });
            await db.collection("all_tips").createIndex({ date: -1 });
            await db
                .collection("all_tips")
                .createIndex({ text: 1 }, { unique: true });
            console.log("Created indexes for all_tips collection");
        }

        // Kontrollera om gamla collections finns
        const hasFrontendTips = await collectionExists(db, "tips");
        const hasBackendTips = await collectionExists(db, "backend_tips");
        const hasFullstackTips = await collectionExists(db, "fullstack_tips");

        // Migrering av frontend-tips
        if (hasFrontendTips) {
            console.log("Migrating frontend tips...");
            const frontendTips = await db.collection("tips").find({}).toArray();

            for (const tip of frontendTips) {
                // Kontrollera om tipset redan finns i nya collectionen
                const exists = await db.collection("all_tips").findOne({
                    text: tip.text.toLowerCase().trim(),
                    category: "frontend",
                });

                if (!exists) {
                    await db.collection("all_tips").insertOne({
                        text: tip.text.toLowerCase().trim(),
                        date: tip.date || new Date(),
                        category: "frontend",
                        difficulty: tip.difficulty || "avancerad",
                        topics: tip.topics || ["CSS", "JavaScript", "React"],
                        feedback: tip.feedback || [],
                    });
                }
            }

            console.log(`Migrated ${frontendTips.length} frontend tips`);
        }

        // Migrering av backend-tips
        if (hasBackendTips) {
            console.log("Migrating backend tips...");
            const backendTips = await db
                .collection("backend_tips")
                .find({})
                .toArray();

            for (const tip of backendTips) {
                // Kontrollera om tipset redan finns i nya collectionen
                const exists = await db.collection("all_tips").findOne({
                    text: tip.text.toLowerCase().trim(),
                    category: "backend",
                });

                if (!exists) {
                    await db.collection("all_tips").insertOne({
                        text: tip.text.toLowerCase().trim(),
                        date: tip.date || new Date(),
                        category: "backend",
                        difficulty: tip.difficulty || "medel",
                        topics: tip.topics || ["databaser", "API", "säkerhet"],
                        feedback: tip.feedback || [],
                    });
                }
            }

            console.log(`Migrated ${backendTips.length} backend tips`);
        }

        // Migrering av fullstack-tips
        if (hasFullstackTips) {
            console.log("Migrating fullstack tips...");
            const fullstackTips = await db
                .collection("fullstack_tips")
                .find({})
                .toArray();

            for (const tip of fullstackTips) {
                // Kontrollera om tipset redan finns i nya collectionen
                const exists = await db.collection("all_tips").findOne({
                    text: tip.text.toLowerCase().trim(),
                    category: "fullstack",
                });

                if (!exists) {
                    await db.collection("all_tips").insertOne({
                        text: tip.text.toLowerCase().trim(),
                        date: tip.date || new Date(),
                        category: "fullstack",
                        difficulty: tip.difficulty || "medel",
                        topics: tip.topics || [
                            "integration",
                            "skalbarhet",
                            "prestanda",
                        ],
                        feedback: tip.feedback || [],
                    });
                }
            }

            console.log(`Migrated ${fullstackTips.length} fullstack tips`);
        }

        // Migrera agentreflektioner
        if (await collectionExists(db, "agent_reflections")) {
            console.log("Reorganizing agent reflections...");

            const reflections = await db
                .collection("agent_reflections")
                .find({})
                .toArray();
            // Uppdatera kategori-fältet om det inte finns
            for (const reflection of reflections) {
                if (!reflection.category) {
                    let category = "frontend";

                    // Försök identifiera kategorin från tipset
                    const lowerTip = reflection.tip.toLowerCase();
                    if (
                        lowerTip.includes("backend") ||
                        lowerTip.includes("databas") ||
                        lowerTip.includes("server")
                    ) {
                        category = "backend";
                    } else if (
                        lowerTip.includes("fullstack") ||
                        lowerTip.includes("stack") ||
                        lowerTip.includes("integration")
                    ) {
                        category = "fullstack";
                    }

                    await db
                        .collection("agent_reflections")
                        .updateOne(
                            { _id: reflection._id },
                            { $set: { category: category } }
                        );
                }
            }

            console.log(`Updated ${reflections.length} agent reflections`);
        }

        console.log("Migration completed successfully!");
    } catch (error) {
        console.error("Error during migration:", error);
    } finally {
        if (client) {
            await client.close();
            console.log("MongoDB connection closed");
        }
    }
}

/**
 * Hjälpfunktion för att kontrollera om en collection finns
 */
async function collectionExists(db, collectionName) {
    const collections = await db.listCollections().toArray();
    return collections.some((c) => c.name === collectionName);
}

// Kör migreringen
migrateData();
