const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const express = require("express");
const puppeteer = require("puppeteer");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = "";
let botStatus = "Starting...";
let lastError = "";

app.get("/", (req, res) => {
    res.send(`
        <html>
        <head>
            <title>WhatsApp Welcome Bot</title>
            <meta http-equiv="refresh" content="8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    background: #1f1f3a;
                    color: white;
                    padding: 40px;
                }
                h1 { color: white; }
                .status {
                    font-size: 28px;
                    color: #ff4d6d;
                    margin: 20px 0;
                }
                .error {
                    color: #ffd166;
                    margin-top: 20px;
                    white-space: pre-wrap;
                }
                img {
                    margin-top: 20px;
                    max-width: 320px;
                    background: white;
                    padding: 12px;
                    border-radius: 12px;
                }
            </style>
        </head>
        <body>
            <h1>🤖 WhatsApp Welcome Bot</h1>
            <div class="status">Status: ${botStatus}</div>
            ${qrCodeData ? `<img src="${qrCodeData}" alt="QR Code" />` : "<p>Loading...</p>"}
            <p>WhatsApp > Linked Devices > Scan</p>
            ${lastError ? `<div class="error">Error: ${lastError}</div>` : ""}
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log("Web server running on port " + PORT);
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: "/tmp/auth"
    }),
    puppeteer: {
        headless: "new",
        executablePath: puppeteer.executablePath(),
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage"
        ]
    }
});

client.on("qr", async (qr) => {
    console.log("QR received!");
    qrcode.generate(qr, { small: true });

    try {
        qrCodeData = await QRCode.toDataURL(qr);
        botStatus = "Scan QR Code now!";
        lastError = "";
    } catch (err) {
        console.error("QR generation error:", err);
        lastError = err.message;
    }
});

client.on("ready", () => {
    console.log("✅ BOT IS ONLINE!");
    botStatus = "✅ Bot is Online!";
    qrCodeData = "";
    lastError = "";
});

client.on("authenticated", () => {
    console.log("Authenticated!");
    botStatus = "Authenticated! Loading...";
});

client.on("auth_failure", (msg) => {
    console.error("Auth failed:", msg);
    botStatus = "❌ Authentication Failed";
    lastError = msg;
});

client.on("loading_screen", (percent, message) => {
    console.log("Loading:", percent, message);
    botStatus = `Loading... ${percent}%`;
});

client.on("disconnected", (reason) => {
    console.log("Disconnected:", reason);
    botStatus = "Disconnected";
    lastError = String(reason);
});

client.on("group_join", async (notification) => {
    try {
        const chat = await notification.getChat();
        const contact = await notification.getContact();

        const memberName = contact.pushname || contact.verifiedName || "New Member";
        const memberNumber = contact.number;
        const memberCount = chat.participants.length;
        const now = new Date();

        const welcomeMsg = config.welcomeMessage
            .replace(/{name}/g, memberName)
            .replace(/{number}/g, memberNumber)
            .replace(/{time}/g, now.toLocaleTimeString())
            .replace(/{date}/g, now.toLocaleDateString())
            .replace(/{memberCount}/g, memberCount);

        await chat.sendMessage(welcomeMsg);
        console.log("Welcome sent to: " + memberName);
    } catch (error) {
        console.error("Welcome error:", error);
    }
});

client.on("group_leave", async (notification) => {
    try {
        const chat = await notification.getChat();
        const contact = await notification.getContact();
        const memberName = contact.pushname || contact.verifiedName || "Member";

        const goodbyeMsg = config.goodbyeMessage.replace(/{name}/g, memberName);
        await chat.sendMessage(goodbyeMsg);
        console.log("Goodbye sent: " + memberName);
    } catch (error) {
        console.error("Goodbye error:", error);
    }
});

client.on("message", async (message) => {
    const body = message.body.toLowerCase().trim();

    if (body === "!ping") {
        await message.reply("🏓 Pong! Bot is alive!");
    }

    if (body === "!help") {
        await message.reply("Commands: !ping, !help, !rules");
    }

    if (body === "!rules") {
        await message.reply("Rules: Be respectful, No spam!");
    }
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
    lastError = reason?.message || String(reason);
    botStatus = "Unhandled Error";
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    lastError = error?.message || String(error);
    botStatus = "Crash Error";
});

console.log("Starting bot...");
client.initialize().catch((err) => {
    console.error("Initialize error:", err);
    lastError = err.message;
    botStatus = "Initialization Failed";
});
