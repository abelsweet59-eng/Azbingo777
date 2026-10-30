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
    "Netsanet", "Av addis", "Solomon", "Taye", "Beke t", "Adane",
    "ተሰማ", "henok", "12 yared b", "abel", "seyum",
    "somalew", "china", "dagi g", "beti i", "jira",
    "lemma", "fikru", "neysi", "faya", "faysel",
    "ahme", "dinu t", "mame mame", "baby", "gfrt", "victor"
].slice(0, 30);

let pendingRequests = {};

// የካርድ ቁጥሮችን ከሴድ (Seed) የማመንጨት ትክክለኛ ሎጂክ
function generateCartelaNumbers(cardNum) {
    let cardNumbersByCol = { B: [], I: [], N: [], G: [], O: [] };
    let seed = cardNum * 17;
    let colRanges = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
    let cols = ['B', 'I', 'N', 'G', 'O'];

    cols.forEach(col => {
        let range = colRanges[col];
        let count = 0;
        while(cardNumbersByCol[col].length < 5) {
            let generated = ((seed + count * 13 + col.charCodeAt(0)) % (range[1] - range[0] + 1)) + range[0];
            if (!cardNumbersByCol[col].includes(generated)) {
                cardNumbersByCol[col].push(generated);
            }
            count++;
        }
    });

    let flatList = [];
    for (let r = 0; r < 5; r++) {
        cols.forEach(col => {
            if (r === 2 && col === 'N') {
                flatList.push("FREE");
            } else {
                flatList.push(cardNumbersByCol[col][r]);
            }
        });
    }
    return flatList;
}

// 🟢 ትክክለኛ የቢንጎ ማሸነፍ ሁኔታ (አግድም፣ ቁመት እና ሰያፍ / Diagonal) ማረጋገጫ
function checkWinningPattern(cardNum, calledNumbers) {
    let numbers = generateCartelaNumbers(cardNum);
    let matrix = [];
    for(let i = 0; i < 5; i++) {
        matrix.push(numbers.slice(i * 5, i * 5 + 5));
    }

    // 1. አግድም (Rows) ማረጋገጥ
    for(let r = 0; r < 5; r++) {
        let win = true;
        for(let c = 0; c < 5; c++) {
            let val = matrix[r][c];
            if(val !== "FREE" && !calledNumbers.includes(val)) {
                win = false;
                break;
            }
        }
        if(win) return true;
    }

    // 2. በቁመት (Cols) ማረጋገጥ
    for(let c = 0; c < 5; c++) {
        let win = true;
        for(let r = 0; r < 5; r++) {
            let val = matrix[r][c];
            if(val !== "FREE" && !calledNumbers.includes(val)) {
                win = false;
                break;
            }
        }
        if(win) return true;
    }

    // 3. ሰያፍ 1 (Top-Left to Bottom-Right Diagonal) ማረጋገጥ
    let diag1Win = true;
    for(let i = 0; i < 5; i++) {
        let val = matrix[i][i];
        if(val !== "FREE" && !calledNumbers.includes(val)) {
            diag1Win = false;
            break;
        }
    }
    if(diag1Win) return true;

    // 4. ሰያፍ 2 (Top-Right to Bottom-Left Diagonal) ማረጋገጥ
    let diag2Win = true;
    for(let i = 0; i < 5; i++) {
        let val = matrix[i][4 - i];
        if(val !== "FREE" && !calledNumbers.includes(val)) {
            diag2Win = false;
            break;
        }
    }
    if(diag2Win) return true;

    return false;
}

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    let message = "🔔 *AZ BINGO - " + reqTypeTitle + "*\n\n👤 ስም: " + (username || 'ተጫዋች') + "\n💰 መጠን: " + amount + " ብር";

    try {
        await axios.post("https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage", {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ አጽድቅ", callback_data: "app_" + requestId },
                    { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }
                ]]
            }
        });
    } catch (error) {}
}

let connectedRealPlayers = [];

io.on('connection', (socket) => {
    connectedRealPlayers.push(socket.id);
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
            socket.emit('cardSelectionError', "⚠️ ይህ ካርድ ተይዟል!");
            return;
        }
        globalRoom.takenCards.push(...selectedCards);
        globalRoom.playerRoundCards[socket.id] = { cards: selectedCards, userId: userId, username: data.username || "ተጫዋች" };
        
        socket.emit('cardSelectionSuccess');
        io.emit('updateTakenCards', globalRoom.takenCards);
    });

    socket.on('disconnect', () => {
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

                // 🟢 የተጠሩት ቁጥሮች በቂ ሲሆኑ ትክክለኛውን ፓተርን (አግድም፣ ቁመት ወይም ሰያፍ) ማረጋገጥ
                if (globalRoom.calledNumbers.length >= 5) {
                    let winningSocketId = null;
                    let winningCard = null;
                    let winningUser = "";
                    let winningUserId = "";

                    let activeSockets = Object.keys(globalRoom.playerRoundCards);

                    // 1. መጀመሪያ የተጫዋቾችን ካርዶች እንፈትሻለን
                    for (let sId of activeSockets) {
                        let pData = globalRoom.playerRoundCards[sId];
                        for (let cNum of pData.cards) {
                            if (checkWinningPattern(cNum, globalRoom.calledNumbers)) {
                                winningSocketId = sId;
                                winningCard = cNum;
                                winningUser = pData.username || "ተጫዋች";
                                winningUserId = pData.userId;
                                break;
                            }
                        }
                        if (winningCard) break;
                    }

                    // 2. ተጫዋቾች ካልወጡ ከነፃ ካርዶች ውስጥ ትክክለኛውን ፓተርን የያዘውን እንፈልጋለን
                    if (!winningCard && globalRoom.calledNumbers.length >= 8) {
                        let candidateCards = [];
                        for (let c = 1; c <= 300; c++) {
                            if (checkWinningPattern(c, globalRoom.calledNumbers)) {
                                candidateCards.push(c);
                            }
                        }
                        if (candidateCards.length > 0) {
                            winningCard = candidateCards[Math.floor(Math.random() * candidateCards.length)];
                            winningUser = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                            winningUserId = "bot_" + Math.floor(Math.random() * 90000 + 10000);
                        }
                    }

                    // አሸናፊ ከተገኘ ጨዋታውን በድል እናስተላልፋለን
                    if (winningCard) {
                        let totalPot = globalRoom.playersCount * 10;
                        let winnerPrize = Math.floor(totalPot * 0.70);

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
                            calledNumbers: globalRoom.calledNumbers
                        });

                        clearInterval(activeGameInterval);
                    }
                }
            } else {
                globalRoom.gameActive = false;
                globalRoom.gameStartTime = Date.now() + roundDuration;
                globalRoom.takenCards = [];
                globalRoom.playerRoundCards = {};
                io.emit('gameEndedBroadcast');
                clearInterval(activeGameInterval);
            }
        }, 4000);
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Bingo Server running on port " + PORT);
});
