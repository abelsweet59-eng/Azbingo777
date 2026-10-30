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

// 🟢 የቦቶችን እና የተጫዋቾችን ካርዶች በየጊዜው በዘፈቀደ (Dynamic) ማስተዳደር
function simulateBotCardSelections() {
    if (globalRoom.gameActive) return;
    
    // የተወሰኑ ቦቶች ካርዶችን እንዲይዙ ማድረግ (ከ 1 እስከ 300 ካሉት መካከል)
    let available = [];
    for(let i = 1; i <= 300; i++) {
        if(!globalRoom.takenCards.includes(i)) available.push(i);
    }

    // በዘፈቀደ ከ 5 እስከ 15 የሚሆኑ ካርዶች በቦቶች እንዲያዙ ማድረግ
    let botPicksCount = Math.floor(Math.random() * 10) + 5;
    for(let i = 0; i < botPicksCount && available.length > 0; i++) {
        let randIdx = Math.floor(Math.random() * available.length);
        let cardToTake = available.splice(randIdx, 1)[0];
        if(!globalRoom.takenCards.includes(cardToTake)) {
            globalRoom.takenCards.push(cardToTake);
        }
    }
    io.emit('updateTakenCards', globalRoom.takenCards);
}

setInterval(simulateBotCardSelections, 8000);

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

    return false;
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
            socket.emit('cardSelectionError', "⚠️ ይቅርታ! ከመረጧቸው ካርዶች መካከል አንዱን ሌላ ተጠቃሚ ቀድሞ ይዞታል።");
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

                if (globalRoom.calledNumbers.length >= 5) {
                    let winningCard = null;
                    let winningUser = "";
                    let winningUserId = "";

                    let activeSockets = Object.keys(globalRoom.playerRoundCards);
                    for (let sId of activeSockets) {
                        let pData = globalRoom.playerRoundCards[sId];
                        for (let cNum of pData.cards) {
                            if (checkWinningPattern(cNum, globalRoom.calledNumbers)) {
                                winningCard = cNum;
                                winningUser = pData.username || "ተጫዋች";
                                winningUserId = pData.userId;
                                break;
                            }
                        }
                        if (winningCard) break;
                    }

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
