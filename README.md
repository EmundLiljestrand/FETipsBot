# AI Tips Discord Bot

En intelligent Discord-bot som genererar programmeringstips inom frontend, backend och fullstack med hjälp av Google Gemini och MongoDB.

## Översikt

Denna bot använder Google Gemini AI för att generera anpassade programmeringstips som kan skickas till Discord. Boten fungerar som en intelligent agent som analyserar tidigare tips för att variera innehållet och anpassa svårighetsgraden.

## Funktioner

-   Daglig automatisk tipsgenering (09:00 svensk tid)
-   Intelligent val av tipskategori baserat på tidigare tips
-   Stöd för frontend-, backend- och fullstack-tips
-   Automatisk svårighetsgradsjustering
-   Självreflekterande AI som förbättrar sig över tid
-   Undviker duplicerade tips med MongoDB-lagring

## Kommandostruktur

-   `!dagens-tips` - Visar ett frontend-tips
-   `!frontend-tips` - Visar ett frontend-tips
-   `!backend-tips` - Visar ett backend-tips
-   `!fullstack-tips` - Visar ett fullstack-tips
-   `!ai-tips` - Låter AI-agenten välja vilken typ av tips som ska visas
-   `!ai-reasoning` - Visar AI-agentens resonemang bakom valet av tips (för debug/admin)

## Teknisk arkitektur

Projektet är byggt med en modulär och skalbar arkitektur:

```
src/
├── agent/
│   ├── agent.js       # AI-agentens huvudlogik
│   └── schema.js      # Schema som definierar agentens funktioner och datamodeller
├── services/
│   ├── database-service.js  # Hanterar MongoDB-anslutning och operationer
│   └── discord-service.js   # Hanterar Discord-integrationen
├── utils/
│   └── prompt-utils.js      # Hjälpfunktioner för att generera AI-prompts
├── app.js             # Orkestrerar tjänster och komponenter
├── config.js          # Centraliserad konfiguration
└── index.js           # Applikationens startpunkt
```

### Arkitekturprinciper

1. **Modularitet** - Varje komponent har ett enda ansvarsområde
2. **Skalbarhet** - Lätt att lägga till nya funktioner och tipstyper
3. **Schema-baserad** - Tydlig definition av agentens förmågor och datastrukturer
4. **Robusthet** - Omfattande felhantering och återhämtning

## Installation

1. Klona projektet
2. Installera beroenden: `npm install`
3. Skapa en `.env`-fil med följande miljövariabler:
    ```
    DISCORD_TOKEN=ditt_discord_token
    GOOGLE_API_KEY=din_google_api_nyckel
    MONGODB_URI=din_mongodb_anslutningssträng
    ```
4. Starta boten: `npm start`

## Körmiljö

-   Node.js 16+
-   MongoDB
-   Internetanslutning för API-anrop till Google Gemini och Discord

## Utveckling

För att utveckla nya funktioner:

1. Expandera schemat i `agent/schema.js` med nya förmågor
2. Implementera funktionerna i `agent/agent.js`
3. Lägg till nya prompts i `utils/prompt-utils.js`
4. Uppdatera konfigurationen i `config.js`
