const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "371093083";

let roundDuration = 60000; // 60 ሰከንድ
let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + roundDuration,
    playersCount: 30,
    takenCards: [],
    playerRoundCards: {}
};

let activeGameInterval = null;

const fakeBotNames = [
    "Av addis", "Solomon", "Taye", "Beke t", "Adane",
    "ተሰማ", "henok", "12 yared b", "abel", "seyum",
    "somalew", "china", "dagi g", "beti i", "jira",
    "lemma", "fikru", "netsanet", "neysi", "faya",
    "faysel", "ahme", "dinu t", "mame mame", "baby",
    "gfrt", "victor", "ga", "mo", "king iv", "djew"
].slice(0, 30);

let pendingRequests = {};

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት (ገንዘብ ማስገቢያ)' : '🏧 ቴሌብር ዊዝድሮዋል (ገንዘብ ማውጣት)';
    
    let message = "🔔 *AZ BINGO - አዲስ የ" + reqTypeTitle + " ጥያቄ*\n\n" +
                  "👤 ስም: " + (username || 'ተጫዋች') + "\n" +
                  "🆔 ID: " + (userId || 'N/A') + "\n" +
                  "📱 ስልክ: " + (phone || 'ቴሌብር') + "\n" +
                  "💰 መጠን: " + amount + " ብር\n" +
                  (receipt ? "🧾 Receipt / SMS:\n" + receipt + "\n" : '') +
                  "\n⚠️ *እባክዎ ከታች ያሉትን አዝራሮች በመጫን ያጽድቁ ወይም ይሰርዙ!*";

    try {
        await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ አጽድቅ (Approve)", callback_data: "app_" + requestId },
                        { text: "❌ ሰርዝ (Reject)", callback_data: "rej_" + requestId }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Telegram admin notification error:", error);
    }
}

let lastUpdateId = 0;
setInterval(async () => {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        let response = await axios.get("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getUpdates?offset=" + (lastUpdateId + 1) + "&timeout=1");
        let updates = response.data.result;
        for (let update of updates) {
            lastUpdateId = update.update_id;
            if (update.callback_query) {
                let cq = update.callback_query;
                let data = cq.data;
                let chatId = cq.message.chat.id;

                if (String(chatId) === String(ADMIN_CHAT_ID)) {
                    let parts = data.split('_');
                    let action = parts[0];
                    let reqId = parts[1] + '_' + parts[2];

                    if (pendingRequests[reqId]) {
                        let req = pendingRequests[reqId];
                        if (action === 'app') {
                            await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
                                chat_id: chatId,
                                text: "✅ ጥያቄው ጸድቋል! የ " + req.amount + " ብር የ " + req.type + " ጥያቄ ተፈጽሟል።"
                            });
                            io.to(req.socketId).emit('financialApproved', { type: req.type, amount: req.amount });
                        } else {
                            await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
                                chat_id: chatId,
                                text: "❌ ጥያቄው ተሰርዟል (Rejected)።"
                            });
                            io.to(req.socketId).emit('financialRejected', { type: req.type, amount: req.amount });
                        }
                        delete pendingRequests[reqId];
                    }
                }
                try {
                    await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/answerCallbackQuery", { callback_query_id: cq.id });
                } catch(e) {}
            }
        }
    } catch (err) {}
}, 2000);

let connectedRealPlayers = [];

io.on('connection', (socket) => {
    console.log("Player connected: " + socket.id);
    if (!connectedRealPlayers.includes(socket.id)) {
        connectedRealPlayers.push(socket.id);
    }
    
    let realCount = connectedRealPlayers.length;
    globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;
    io.emit('updatePlayersCount', globalRoom.playersCount);

    socket.emit('syncGameState', globalRoom);
    socket.emit('updateTakenCards', globalRoom.takenCards);

    socket.on('confirmCards', (data) => {
        let selectedCards = data.cards || data;
        let userId = data.userId || socket.id;

        let conflict = selectedCards.some(card => globalRoom.takenCards.includes(card));
        if (conflict) {
            socket.emit('cardSelectionError', "⚠️ ይቅርታ! ከመረጧቸው ካርዶች መካከል አንዱን ሌላ ተጠቃሚ ቀድሞ ይዞታል። እባክዎ ሌላ ይምረጡ።");
            return;
        }
        globalRoom.takenCards.push(...selectedCards);
        globalRoom.playerRoundCards[socket.id] = { cards: selectedCards, userId: userId };
        
        socket.emit('cardSelectionSuccess');
        io.emit('updateTakenCards', globalRoom.takenCards);
    });

    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, phone, receipt } = data;
        
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ከ 100 ብር በታች ማዘዝ ወይም ማስገባት አይቻልም! ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }

        let requestId = 'req_' + Math.floor(Math.random() * 1000000);
        pendingRequests[requestId] = { userId, type, amount, socketId: socket.id };

        await sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: "የ " + amount + " ብር ጥያቄዎ ለአድሚን ቴሌግራም ተልኳል! አድሚኑ ሲያጸድቀው በቅጽበት ይስተካከላል።" });
    });

    socket.on('disconnect', () => {
        console.log("Player connected: " + socket.id);
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        let realCount = connectedRealPlayers.length;
        globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

setInterval(() => {
    let now = Date.now();
    let realCount = connectedRealPlayers.length;
    globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;

    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        io.emit('gameStartedBroadcast');

        if (activeGameInterval) clearInterval(activeGameInterval);

        activeGameInterval = setInterval(() => {
            if (!globalRoom.gameActive) {
                clearInterval(activeGameInterval);
                return;
            }
            let available = Array.from({length: 75}, (_, i) => i + 1).filter(n => !globalRoom.calledNumbers.includes(n));
            if (available.length > 0) {
                let num = available[Math.floor(Math.random() * available.length)];
                globalRoom.calledNumbers.push(num);
                io.emit('numberCalledBroadcast', num);

                if (globalRoom.calledNumbers.length >= 15 && Math.random() < 0.15) {
                    let winningUser = "";
                    let winningUserId = "";
                    let winningCard = 1;
                    let winnerPrize = 0;

                    let totalPot = globalRoom.playersCount * 10;
                    winnerPrize = Math.floor(totalPot * 0.70);

                    let activeSocketsWithCards = Object.keys(globalRoom.playerRoundCards);
                    let shouldUserWin = activeSocketsWithCards.length > 0 && Math.random() < 0.5;

                    if (shouldUserWin) {
                        let winningSocketId = activeSocketsWithCards[Math.floor(Math.random() * activeSocketsWithCards.length)];
                        let playerData = globalRoom.playerRoundCards[winningSocketId];
                        winningUser = "ተጫዋች";
                        winningUserId = playerData.userId;
                        let userCards = playerData.cards;
                        winningCard = userCards[Math.floor(Math.random() * userCards.length)];
                    } else {
                        winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                        winningUserId = "bot_" + Math.floor(Math.random() * 90000 + 10000);
                        
                        let unselectedCards = [];
                        for (let c = 1; c <= 300; c++) {
                            if (!globalRoom.takenCards.includes(c)) {
                                unselectedCards.push(c);
                            }
                        }
                        if (unselectedCards.length > 0) {
                            winningCard = unselectedCards[Math.floor(Math.random() * unselectedCards.length)];
                        } else {
                            winningCard = Math.floor(Math.random() * 300) + 1;
                        }
                    }

                    globalRoom.gameActive = false;
                    globalRoom.gameStartTime = Date.now() + roundDuration;
                    globalRoom.takenCards = [];
                    globalRoom.playerRoundCards = {};

                    io.emit('bingoWinner', { 
                        username: winningUser, 
                        userId: winningUserId,
                        cardNum: winningCard,
                        playersCount: globalRoom.playersCount,
                        totalPot: totalPot,
                        prize: winnerPrize, 
                        message: "🎉 BINGO WINNER!" 
                    });

                    clearInterval(activeGameInterval);
                }
            } else {
                globalRoom.gameActive = false;
                globalRoom.gameStartTime = Date.now() + roundDuration;
                globalRoom.takenCards = [];
                globalRoom.playerRoundCards = {};
                io.emit('gameEndedBroadcast');
                clearInterval(activeGameInterval);
            }
        }, 5000);
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Bingo Server running on port " + PORT);
});
 express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "371093083";

let roundDuration = 60000; // 60 ሰከንድ
let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + roundDuration,
    playersCount: 30,
    takenCards: [],
    playerRoundCards: {}
};

let activeGameInterval = null;

const fakeBotNames = [
    "Av addis", "Solomon", "Taye", "Beke t", "Adane",
    "ተሰማ", "henok", "12 yared b", "abel", "seyum",
    "somalew", "china", "dagi g", "beti i", "jira",
    "lemma", "fikru", "netsanet", "neysi", "faya",
    "faysel", "ahme", "dinu t", "mame mame", "baby",
    "gfrt", "victor", "ga", "mo", "king iv", "djew"
].slice(0, 30);

let pendingRequests = {};

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት (ገንዘብ ማስገቢያ)' : '🏧 ቴሌብር ዊዝድሮዋል (ገንዘብ ማውጣት)';
    
    let message = "🔔 *AZ BINGO - አዲስ የ" + reqTypeTitle + " ጥያቄ*\n\n" +
                  "👤 ስም: " + (username || 'ተጫዋች') + "\n" +
                  "🆔 ID: " + (userId || 'N/A') + "\n" +
                  "📱 ስልክ: " + (phone || 'ቴሌብር') + "\n" +
                  "💰 መጠን: " + amount + " ብር\n" +
                  (receipt ? "🧾 Receipt / SMS:\n" + receipt + "\n" : '') +
                  "\n⚠️ *እባክዎ ከታች ያሉትን አዝራሮች በመጫን ያጽድቁ ወይም ይሰርዙ!*";

    try {
        await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ አጽድቅ (Approve)", callback_data: "app_" + requestId },
                        { text: "❌ ሰርዝ (Reject)", callback_data: "rej_" + requestId }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Telegram admin notification error:", error);
    }
}

let lastUpdateId = 0;
setInterval(async () => {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        let response = await axios.get("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getUpdates?offset=" + (lastUpdateId + 1) + "&timeout=1");
        let updates = response.data.result;
        for (let update of updates) {
            lastUpdateId = update.update_id;
            if (update.callback_query) {
                let cq = update.callback_query;
                let data = cq.data;
                let chatId = cq.message.chat.id;

                if (String(chatId) === String(ADMIN_CHAT_ID)) {
                    let parts = data.split('_');
                    let action = parts[0];
                    let reqId = parts[1] + '_' + parts[2];

                    if (pendingRequests[reqId]) {
                        let req = pendingRequests[reqId];
                        if (action === 'app') {
                            await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
                                chat_id: chatId,
                                text: "✅ ጥያቄው ጸድቋል! የ " + req.amount + " ብር የ " + req.type + " ጥያቄ ተፈጽሟል።"
                            });
                            io.to(req.socketId).emit('financialApproved', { type: req.type, amount: req.amount });
                        } else {
                            await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
                                chat_id: chatId,
                                text: "❌ ጥያቄው ተሰርዟል (Rejected)።"
                            });
                            io.to(req.socketId).emit('financialRejected', { type: req.type, amount: req.amount });
                        }
                        delete pendingRequests[reqId];
                    }
                }
                try {
                    await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/answerCallbackQuery", { callback_query_id: cq.id });
                } catch(e) {}
            }
        }
    } catch (err) {}
}, 2000);

let connectedRealPlayers = [];

io.on('connection', (socket) => {
    console.log("Player connected: " + socket.id);
    if (!connectedRealPlayers.includes(socket.id)) {
        connectedRealPlayers.push(socket.id);
    }
    
    let realCount = connectedRealPlayers.length;
    globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;
    io.emit('updatePlayersCount', globalRoom.playersCount);

    socket.emit('syncGameState', globalRoom);
    socket.emit('updateTakenCards', globalRoom.takenCards);

    socket.on('confirmCards', (data) => {
        let selectedCards = data.cards || data;
        let userId = data.userId || socket.id;

        let conflict = selectedCards.some(card => globalRoom.takenCards.includes(card));
        if (conflict) {
            socket.emit('cardSelectionError', "⚠️ ይቅርታ! ከመረጧቸው ካርዶች መካከል አንዱን ሌላ ተጠቃሚ ቀድሞ ይዞታል። እባክዎ ሌላ ይምረጡ።");
            return;
        }
        globalRoom.takenCards.push(...selectedCards);
        globalRoom.playerRoundCards[socket.id] = { cards: selectedCards, userId: userId };
        
        socket.emit('cardSelectionSuccess');
        io.emit('updateTakenCards', globalRoom.takenCards);
    });

    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, phone, receipt } = data;
        
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ከ 100 ብር በታች ማዘዝ ወይም ማስገባት አይቻልም! ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }

        let requestId = 'req_' + Math.floor(Math.random() * 1000000);
        pendingRequests[requestId] = { userId, type, amount, socketId: socket.id };

        await sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: "የ " + amount + " ብር ጥያቄዎ ለአድሚን ቴሌግራም ተልኳል! አድሚኑ ሲያጸድቀው በቅጽበት ይስተካከላል።" });
    });

    socket.on('disconnect', () => {
        console.log("Player disconnected: " + socket.id);
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        let realCount = connectedRealPlayers.length;
        globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

// 🟢 የተስተካከለ የሰርቨር ቆጣሪ እና የኳስ ጥሪ ሎጂክ (ግሊች እንዳይኖር የተደረገ)
setInterval(() => {
    let now = Date.now();
    let realCount = connectedRealPlayers.length;
    globalRoom.playersCount = realCount < 60 ? 30 + realCount : realCount;

    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        io.emit('gameStartedBroadcast');

        if (activeGameInterval) clearInterval(activeGameInterval);

        activeGameInterval = setInterval(() => {
            if (!globalRoom.gameActive) {
                clearInterval(activeGameInterval);
                return;
            }
            let available = Array.from({length: 75}, (_, i) => i + 1).filter(n => !globalRoom.calledNumbers.includes(n));
            if (available.length > 0) {
                let num = available[Math.floor(Math.random() * available.length)];
                globalRoom.calledNumbers.push(num);
                io.emit('numberCalledBroadcast', num);

                if (globalRoom.calledNumbers.length >= 15 && Math.random() < 0.15) {
                    let winningUser = "";
                    let winningUserId = "";
                    let winningCard = 1;
                    let winnerPrize = 0;

                    let totalPot = globalRoom.playersCount * 10;
                    winnerPrize = Math.floor(totalPot * 0.70);

                    let activeSocketsWithCards = Object.keys(globalRoom.playerRoundCards);
                    let shouldUserWin = activeSocketsWithCards.length > 0 && Math.random() < 0.5;

                    if (shouldUserWin) {
                        let winningSocketId = activeSocketsWithCards[Math.floor(Math.random() * activeSocketsWithCards.length)];
                        let playerData = globalRoom.playerRoundCards[winningSocketId];
                        winningUser = "ተጫዋች";
                        winningUserId = playerData.userId;
                        let userCards = playerData.cards;
                        winningCard = userCards[Math.floor(Math.random() * userCards.length)];
                    } else {
                        winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                        winningUserId = "bot_" + Math.floor(Math.random() * 90000 + 10000);
                        
                        let unselectedCards = [];
                        for (let c = 1; c <= 300; c++) {
                            if (!globalRoom.takenCards.includes(c)) {
                                unselectedCards.push(c);
                            }
                        }
                        if (unselectedCards.length > 0) {
                            winningCard = unselectedCards[Math.floor(Math.random() * unselectedCards.length)];
                        } else {
                            winningCard = Math.floor(Math.random() * 300) + 1;
                        }
                    }

                    globalRoom.gameActive = false;
                    globalRoom.gameStartTime = Date.now() + roundDuration;
                    globalRoom.takenCards = [];
                    globalRoom.playerRoundCards = {};

                    io.emit('bingoWinner', { 
                        username: winningUser, 
                        userId: winningUserId,
                        cardNum
