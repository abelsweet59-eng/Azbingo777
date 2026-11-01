const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🟢 የፊት መግቢያ ሎቢ እና የቢንጎ ጌም ራውቶች
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/bingo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bingo.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "371093083";

let roundDuration = 60000;
let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + roundDuration,
    playersCount: 140,
    takenCards: [],
    playerRoundCards: {},
    playerTemporaryCards: {}
};

let forcedNextWinner = null; 
let onlineRealUsers = [];
let pendingRequests = {};

function getRealisticBotsCount(realCount) {
    const now = new Date();
    let utcHours = now.getUTCHours();
    let utcMinutes = now.getUTCMinutes();
    let ethiopianHour = (utcHours + 3) % 24; 
    let totalMinutesFrom16 = ((ethiopianHour - 16 + 24) % 24) * 60 + utcMinutes;
    let maxDurationMinutes = 8 * 60;
    let calculated = 95;
    if (ethiopianHour >= 16 || ethiopianHour < 1) {
        let progress = Math.min(1, Math.max(0, totalMinutesFrom16 / maxDurationMinutes));
        calculated = Math.floor(90 + (progress * 230) + (Math.sin(Date.now() / 3000) * 12));
    } else {
        calculated = 85 + Math.floor(Math.sin(Date.now() / 5000) * 10);
    }
    let smallDelta = Math.floor(Math.random() * 7) - 3; 
    let finalCount = calculated + smallDelta;
    if (finalCount < 70) finalCount = 75;
    if (finalCount > 350) finalCount = 345;
    return finalCount;
}

function refreshTakenCardsList() {
    let allTaken = [];
    Object.values(globalRoom.playerRoundCards).forEach(p => {
        if (p.cards) allTaken.push(...p.cards);
    });
    Object.values(globalRoom.playerTemporaryCards).forEach(cards => {
        if (cards) allTaken.push(...cards);
    });
    globalRoom.takenCards = Array.from(new Set(allTaken));
    io.emit('updateTakenCards', globalRoom.takenCards);
}

function simulateBotCardSelections() {
    if (globalRoom.gameActive) return;
    let available = [];
    for(let i = 1; i <= 500; i++) {
        if(!globalRoom.takenCards.includes(i)) available.push(i);
    }
    let botPicksCount = Math.floor(Math.random() * 15) + 10;
    for(let i = 0; i < botPicksCount && available.length > 0; i++) {
        let randIdx = Math.floor(Math.random() * available.length);
        let cardToTake = available.splice(randIdx, 1)[0];
        if(!globalRoom.takenCards.includes(cardToTake)) {
            globalRoom.takenCards.push(cardToTake);
        }
    }
    io.emit('updateTakenCards', globalRoom.takenCards);
}

setInterval(simulateBotCardSelections, 6000);

let telegramOffset = 0;
async function pollTelegramUpdates() {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        let response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`, {
            params: { offset: telegramOffset, timeout: 30 }
        });
        if (response.data && response.data.ok) {
            let updates = response.data.result;
            for (let update of updates) {
                telegramOffset = update.update_id + 1;
                if (update.callback_query) {
                    let callbackQuery = update.callback_query;
                    let data = callbackQuery.data; 
                    let chatId = callbackQuery.message.chat.id;
                    let messageId = callbackQuery.message.message_id;
                    let parts = data.split('_');
                    let action = parts[0]; 
                    let requestId = parts.slice(1).join('_');
                    let reqData = pendingRequests[requestId];

                    if (reqData) {
                        let targetSocket = io.sockets.sockets.get(reqData.socketId);
                        if (action === 'app') {
                            if (targetSocket) {
                                let finalAmountForClient = (reqData.type === 'withdraw' || reqData.type === 'withdrawal') ? -Math.abs(reqData.amount) : reqData.amount;
                                targetSocket.emit('financialApproved', { 
                                    type: reqData.type, 
                                    amount: reqData.amount,
                                    adjustedAmount: finalAmountForClient 
                                });
                            }
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            });
                        } else {
                            if (targetSocket) {
                                targetSocket.emit('financialRejected', { type: reqData.type, amount: reqData.amount });
                            }
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `❌ *ጥያቄው ተሰርዟል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            });
                        }
                        delete pendingRequests[requestId]; 
                    } else {
                        try {
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `⚠️ *ይህ ጥያቄ ጊዜው አልፎአል ወይም ቀድሞ ተጠናቋል!*`, parse_mode: 'Markdown'
                            });
                        } catch (e) {}
                    }
                    try { await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: callbackQuery.id }); } catch (e) {}
                }
            }
        }
    } catch (err) {}
    setTimeout(pollTelegramUpdates, 1000);
}
setTimeout(pollTelegramUpdates, 2000);

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}`;
    if (receipt) message += `\n\n📄 *ደረሰኝ / SMS:*\n\`${receipt}\``;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: "✅ አጽድቅ", callback_data: "app_" + requestId }, { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }]] }
        });
    } catch (error) {}
}

let connectedRealPlayers = [];

io.on('connection', (socket) => {
    connectedRealPlayers.push(socket.id);
    let realCount = connectedRealPlayers.length;
    let currentBotsCount = getRealisticBotsCount(realCount);
    globalRoom.playersCount = currentBotsCount + realCount; 
    io.emit('updatePlayersCount', globalRoom.playersCount);
    socket.emit('syncGameState', globalRoom);
    refreshTakenCardsList();

    socket.on('registerRealUser', (userData) => {
        if (userData && userData.userId) {
            onlineRealUsers = onlineRealUsers.filter(u => u.userId !== userData.userId);
            onlineRealUsers.push({
                socketId: socket.id,
                userId: userData.userId,
                username: userData.username || 'No Username',
                fullName: userData.fullName || 'User'
            });
        }
    });

    socket.on('getAdminRealUsers', () => {
        socket.emit('adminRealUsersListUpdate', onlineRealUsers);
    });

    socket.on('tempSelectCards', (cards) => {
        if (Array.isArray(cards)) {
            globalRoom.playerTemporaryCards[socket.id] = cards;
            refreshTakenCardsList();
        }
    });

    socket.on('confirmCards', (data) => {
        let selectedCards = data.cards || data;
        let userId = String(data.userId || socket.id);
        let conflict = selectedCards.some(card => {
            let inOtherTemp = Object.entries(globalRoom.playerTemporaryCards).some(([sId, cList]) => sId !== socket.id && cList.includes(card));
            let inOtherConfirmed = Object.entries(globalRoom.playerRoundCards).some(([sId, p]) => sId !== socket.id && p.cards.includes(card));
            return inOtherTemp || inOtherConfirmed;
        });

        if (conflict) {
            socket.emit('cardSelectionError', "⚠️ ይቅርታ! ይህ ካርድ በሌላ ተጫዋች ተይዟል!");
            return;
        }

        delete globalRoom.playerTemporaryCards[socket.id];
        globalRoom.playerRoundCards[socket.id] = { cards: selectedCards, userId: userId, username: data.username || "ተጫዋች" };
        socket.emit('cardSelectionSuccess');
        refreshTakenCardsList();
    });

    socket.on('adminSetNextWinner', (data) => {
        forcedNextWinner = data.winnerType ? String(data.winnerType).trim() : null;
        socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል: ${forcedNextWinner}` });
    });

    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, currentBalance, phone, receipt } = data;
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }
        if (type === 'deposit' && (!receipt || receipt.length < 3)) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ እባክዎ የቴሌብር ደረሰኝ በትክክል ያስገቡ!' });
            return;
        }
        let requestId = 'req_' + Math.floor(Math.random() * 10000000) + '_' + Date.now();
        pendingRequests[requestId] = { userId, type, amount, username, socketId: socket.id, timestamp: Date.now() };
        
        await sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    });

    socket.on('disconnect', () => {
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        onlineRealUsers = onlineRealUsers.filter(u => u.socketId !== socket.id);
        delete globalRoom.playerRoundCards[socket.id];
        delete globalRoom.playerTemporaryCards[socket.id];
        refreshTakenCardsList();
        let realCount = connectedRealPlayers.length;
        let currentBotsCount = getRealisticBotsCount(realCount);
        globalRoom.playersCount = currentBotsCount + realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Bingo Server running on port " + PORT);
});
