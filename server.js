const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.express = express;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_IDS = ["371093083", "8648229637"];
const ADMIN_CHAT_ID = ADMIN_CHAT_IDS[0];

const claimedWelcomeBonusUsers = new Set();
const userWallets = {}; 

const allRegisteredUsers = new Set();

let isDepositLocked = false;
let isWithdrawLocked = false;

const baseNumberFlowSequence = [
    17, 19, 22, 23, 32, 18, 19, 12, 27, 27, 23, 17, 19, 19, 22, 19, 24, 23, 19, 18, 16, 14, 22, 26, 30, 32, 17, 18, 18, 18, 22, 27, 32, 27, 19, 18, 21, 20, 26, 25, 19, 18, 23, 26, 19, 19, 13, 15, 12, 24, 19, 12, 16, 33, 11, 22, 18, 16, 22, 32, 32, 14, 19, 18, 13, 17, 18, 12, 30, 21, 19, 18, 28, 26, 24, 19, 13, 17, 17, 30, 18, 19
];
let sequenceIndex = 0;

const ETHIOPIAN_BOT_NAMES = [
    "ኬላ", "ፓፓ", "asrat00", "kesho", "በላይ", "መሌ", "hamud", "ali ali", "aste19", "nati47", 
    "kida7k", "natinati", "goshu", "gadeion", "aster asta", "yonasjo", "temesgen19", "የኔ", "ቤላ", 
    "Dawit Mohamed", "sani", "eyobeyob", "0947151407", "halal", "ebrahim ebra",
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
    lastCalledNumber: null,
    targetWinCallCount: 12,
    forcedWinningCardNums: []
};

let forcedNextWinner = null; 
let enableOnlyRealUsersMode = false; 
let onlineRealUsers = [];
let pendingRequests = {};
let offlineApprovedQueue = {}; 
let gameInterval = null;
let numberCallInterval = null;
let connectedRealPlayers = [];

function getCartelaNumbers(cardNum) {
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

function getWinningMatchedIndices(winningCardNumbers, calledNumbers) {
    if (!calledNumbers || calledNumbers.length === 0) return null;

    let grid2D = [];
    let cleanCalled = calledNumbers.map(n => Number(n));
    
    for(let r=0; r<5; r++) {
        let row = [];
        for(let c=0; c<5; c++) {
            let idx = r * 5 + c;
            let val = winningCardNumbers[idx];
            let isHit = (val === "FREE" || cleanCalled.includes(Number(val)));
            row.push({ idx, isHit, val });
        }
        grid2D.push(row);
    }

    for(let r=0; r<5; r++) {
        if(grid2D[r].every(cell => cell.isHit)) {
            return grid2D[r].map(cell => cell.idx);
        }
    }

    for(let c=0; c<5; c++) {
        let colHits = true;
        let colCells = [];
        for(let r=0; r<5; r++) {
            colCells.push(grid2D[r][c]);
            if(!grid2D[r][c].isHit) colHits = false;
        }
        if(colHits) {
            return colCells.map(cell => cell.idx);
        }
    }

    let diag1Hits = true, diag2Hits = true;
    let diag1Cells = [], diag2Cells = [];
    for(let i=0; i<5; i++) {
        diag1Cells.push(grid2D[i][i]);
        diag2Cells.push(grid2D[i][4-i]);
        if(!grid2D[i][i].isHit) diag1Hits = false;
        if(!grid2D[i][4-i].isHit) diag2Hits = false;
    }
    if(diag1Hits) return diag1Cells.map(cell => cell.idx);
    if(diag2Hits) return diag2Cells.map(cell => cell.idx);

    if(grid2D[0][0].isHit && grid2D[0][4].isHit && grid2D[4][0].isHit && grid2D[4][4].isHit) {
        return [0, 4, 20, 24];
    }

    return null;
}

function getRemainingCountForCard(winningCardNumbers, calledNumbers) {
    let cleanCalled = new Set(calledNumbers.map(n => Number(n)));
    cleanCalled.add("FREE");

    let possiblePatterns = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
        [0,6,12,18,24], [4,8,12,16,20],
        [0,4,20,24]
    ];

    let minMissing = 999;
    for (let p of possiblePatterns) {
        let missingInPattern = 0;
        for (let idx of p) {
            let val = winningCardNumbers[idx];
            if (val !== "FREE" && !cleanCalled.has(Number(val))) {
                missingInPattern++;
            }
        }
        if (missingInPattern < minMissing) {
            minMissing = missingInPattern;
        }
    }
    return minMissing;
}

let lastSmoothCount = 95; 

function getRealisticBotsCount(realCount, isGameActive = false) {
    if (enableOnlyRealUsersMode) return 0;

    const now = new Date();
    let utcHours = now.getUTCHours();
    let ethiopianHour = (utcHours + 3) % 24; 
    let targetBase = 95;

    if (ethiopianHour >= 6 && ethiopianHour < 12) {
        targetBase = 50 + Math.floor(Math.random() * 10); 
    } else if (ethiopianHour >= 12 && ethiopianHour < 19) {
        let progress = (ethiopianHour - 12) / 7; 
        targetBase = Math.floor(60 + (progress * 20) + Math.random() * 5); 
    } else if (ethiopianHour >= 19 || ethiopianHour < 3) {
        targetBase = 120 + Math.floor(Math.random() * 131); 
    } else {
        targetBase = 60 + Math.floor(Math.random() * 31); 
    }

    if (isGameActive) {
        lastSmoothCount = targetBase;
    } else {
        let step = Math.floor(Math.random() * 5) + 1; 
        if (lastSmoothCount < targetBase) {
            lastSmoothCount += step;
            if (lastSmoothCount > targetBase) lastSmoothCount = targetBase;
        } else if (lastSmoothCount > targetBase) {
            lastSmoothCount -= step;
            if (lastSmoothCount < targetBase) lastSmoothCount = targetBase;
        } else {
            let minorDelta = (Math.floor(Math.random() * 3) + 1) * (Math.random() < 0.5 ? 1 : -1);
            lastSmoothCount += minorDelta;
        }
    }

    if (lastSmoothCount < 40) lastSmoothCount = 40;
    if (lastSmoothCount > 250) lastSmoothCount = 250;

    return lastSmoothCount;
}

function updateRoomPlayersAndPot() {
    let realCount = connectedRealPlayers.length;
    let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([sId, data]) => data.cards && data.cards.length > 0);
    
    if (enableOnlyRealUsersMode) {
        let uniqueRealCardsCount = 0;
        activeRealEntries.forEach(([sId, data]) => {
            if (data.cards) uniqueRealCardsCount += data.cards.length;
        });
        globalRoom.playersCount = uniqueRealCardsCount > 0 ? uniqueRealCardsCount : activeRealEntries.length;
        if (globalRoom.playersCount === 0) globalRoom.playersCount = realCount > 0 ? realCount : 1;
    } else {
        let currentBotsCount = getRealisticBotsCount(realCount, globalRoom.gameActive);
        globalRoom.playersCount = currentBotsCount + realCount; 
    }
    io.emit('updatePlayersCount', globalRoom.playersCount);
}

setInterval(() => {
    if (!globalRoom.gameActive) {
        updateRoomPlayersAndPot();
    }
}, 4000);

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
    if (globalRoom.gameActive || enableOnlyRealUsersMode) return;
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

async function sendWinnerNotificationToAdmin(winnerNamesStr, cardNum, prizePerWinner, isRealUser) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_IDS.length || !isRealUser) return;
    let message = `🏆 *AZ BINGO - 👤 አሸናፊ(ዎች)*\n\n🎉 አሸናፊዎች: *${winnerNamesStr}*\n🔢 ዋና ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው የድርሻ ብር (ለእያንዳንዱ): *${prizePerWinner} ብር*\n👥 ተጫዋቾች ብዛት: ${globalRoom.playersCount}`;
    
    for (let adminChatId of ADMIN_CHAT_IDS) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: adminChatId, text: message, parse_mode: 'Markdown'
            });
        } catch (error) {}
    }
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
            
            updateRoomPlayersAndPot();

            let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
            let currentWinnerType = forcedNextWinner;
            forcedNextWinner = null; 

            if (enableOnlyRealUsersMode) {
                let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
                availableNumbers.sort(() => 0.5 - Math.random());

                io.emit('gameStarted', { calledNumbers: [] });
                io.emit('gameStartedBroadcast');

                if (numberCallInterval) clearInterval(numberCallInterval);

                numberCallInterval = setInterval(() => {
                    if (!globalRoom.gameActive) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        return;
                    }

                    let currentActiveRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
                    
                    if (currentActiveRealEntries.length === 0) {
                        if (availableNumbers.length === 0 || globalRoom.calledNumbers.length >= 75) {
                            if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                            setTimeout(() => { endRoundAndRestart(); }, 3000);
                            return;
                        }
                    }

                    if (availableNumbers.length === 0) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        setTimeout(() => { endRoundAndRestart(); }, 3000);
                        return;
                    }

                    let calledNum = availableNumbers.shift();
                    globalRoom.calledNumbers.push(Number(calledNum));
                    globalRoom.lastCalledNumber = Number(calledNum);

                    io.emit('numberCalled', {
                        number: Number(calledNum),
                        calledNumbers: globalRoom.calledNumbers
                    });
                    io.emit('numberCalledBroadcast', Number(calledNum));

                    let winningWinnersList = [];
                    Object.entries(globalRoom.playerRoundCards).forEach(([socketId, pData]) => {
                        if (pData && pData.cards) {
                            pData.cards.forEach(cNum => {
                                let cList = getCartelaNumbers(cNum);
                                let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers);
                                if (matched) { 
                                    winningWinnersList.push({
                                        username: pData.username || 'ተጫዋች',
                                        socketId: socketId,
                                        userId: pData.userId,
                                        isBot: false,
                                        cardNum: cNum,
                                        matched: matched,
                                        cartelaList: cList
                                    });
                                }
                            });
                        }
                    });

                    if (winningWinnersList.length > 0) {
                        let primaryWinner = winningWinnersList[0];
                        let winningPrimaryCardNum = primaryWinner.cardNum;
                        let winningMatchedIndices = primaryWinner.matched;

                        let winnerNamesStr = winningWinnersList.map(w => w.username).join(', ');
                        let winnersCount = winningWinnersList.length;

                        let totalPot = (globalRoom.playersCount || 1) * 10;
                        let prizePerWinner = Math.floor(((totalPot * 0.90) / winnersCount));

                        winningWinnersList.forEach(w => {
                            if (!w.isBot && w.userId) {
                                userWallets[w.userId] = (userWallets[w.userId] || 0) + prizePerWinner;
                            }
                        });

                        sendWinnerNotificationToAdmin(winnerNamesStr, winningPrimaryCardNum, prizePerWinner, true);

                        winningWinnersList.forEach(w => {
                            if (!w.isBot && w.socketId) {
                                let targetSocket = io.sockets.sockets.get(w.socketId);
                                if (targetSocket) {
                                    targetSocket.emit('rewardPrize', { prize: prizePerWinner, balance: userWallets[w.userId] });
                                }
                            }
                        });

                        io.emit('bingoWinner', {
                            username: winnerNamesStr,
                            userId: winningWinnersList.find(w => !w.isBot)?.socketId || null,
                            cardNum: winningPrimaryCardNum,
                            prize: prizePerWinner,
                            calledNumbers: globalRoom.calledNumbers,
                            matchedIndices: winningMatchedIndices,
                            winnersCount: winnersCount,
                            playersCount: globalRoom.playersCount
                        });

                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        setTimeout(() => { endRoundAndRestart(); }, 6000);
                    }

                }, 4500);

                return;
            }

            let winningUsernamesArr = [];
            let winningSocketData = []; 
            let winnersCount = Math.random() < 0.75 ? 1 : 2; 
            let winningCardNums = [];

            let targetRealCount = 0;
            let explicitRealForced = (currentWinnerType === 'only_real_users' || currentWinnerType === 'random_real' || currentWinnerType === 'random_3_real' || currentWinnerType === 'multi_real_3' || currentWinnerType === 'real_user' || currentWinnerType === 'single_real');

            if (explicitRealForced && activeRealEntries.length > 0) {
                if ((currentWinnerType && (currentWinnerType.includes('3') || currentWinnerType === 'multi_real_3' || currentWinnerType === 'random_3_real')) && activeRealEntries.length >= 3) {
                    targetRealCount = 3;
                    winnersCount = 3; 
                } else {
                    targetRealCount = 1;
                    winnersCount = 1; 
                }
            }

            if (targetRealCount > 0 && activeRealEntries.length > 0) {
                let shuffledReal = [...activeRealEntries].sort(() => 0.5 - Math.random());
                let chosenReal = shuffledReal.slice(0, targetRealCount);
                chosenReal.forEach(item => {
                    winningUsernamesArr.push(item[1].username);
                    winningSocketData.push({ socketId: item[0], userId: item[1].userId, isBot: false });
                    winningCardNums.push(item[1].cards && item[1].cards.length > 0 ? item[1].cards[0] : Math.floor(Math.random() * 450) + 1);
                });
            }

            while (winningUsernamesArr.length < winnersCount) {
                let bName = getRandomBotNames(1)[0];
                winningUsernamesArr.push(bName);
                winningSocketData.push({ socketId: null, userId: null, isBot: true });
                winningCardNums.push(Math.floor(Math.random() * 450) + 1);
            }

            winnersCount = winningUsernamesArr.length > 0 ? winningUsernamesArr.length : 1;
            globalRoom.forcedWinningCardNums = winningCardNums;
            
            let targetCallCount = baseNumberFlowSequence[sequenceIndex];
            
            sequenceIndex++;
            if (sequenceIndex >= baseNumberFlowSequence.length) {
                sequenceIndex = 0; 
            }

            let possiblePatterns = [
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                [0,6,12,18,24], [4,8,12,16,20],
                [0,4,20,24]
            ];

            let sharedPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];

            let perWinnerConfigs = winningCardNums.map(cNum => {
                let cList = getCartelaNumbers(cNum);
                let p = sharedPattern; 
                let reqNums = p.map(idx => cList[idx]).filter(n => n !== "FREE");

                let allIndices = Array.from({length: 25}, (_, i) => i).filter(i => i !== 12 && !p.includes(i));
                let shuffledExtra = allIndices.sort(() => 0.5 - Math.random()).slice(0, 4);
                let extraNums = shuffledExtra.map(idx => cList[idx]).filter(n => n !== "FREE");

                let combinedRequired = [...new Set([...reqNums, ...extraNums])];

                return { cardNum: cNum, cartelaList: cList, patternIndices: p, requiredNumbers: combinedRequired };
            });

            let interleavedWinningNumbers = [];
            let maxLength = Math.max(...perWinnerConfigs.map(cfg => cfg.requiredNumbers.length));
            
            for (let i = 0; i < maxLength; i++) {
                perWinnerConfigs.forEach(cfg => {
                    if (cfg.requiredNumbers[i] !== undefined && !interleavedWinningNumbers.includes(cfg.requiredNumbers[i])) {
                        interleavedWinningNumbers.push(cfg.requiredNumbers[i]);
                    }
                });
            }

            let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
            availableNumbers.sort(() => 0.5 - Math.random());
            
            io.emit('gameStarted', { calledNumbers: [] });
            io.emit('gameStartedBroadcast');

            if (numberCallInterval) clearInterval(numberCallInterval);
            
            let winNumQueue = [...interleavedWinningNumbers];

            numberCallInterval = setInterval(() => {
                if (!globalRoom.gameActive) {
                    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    return;
                }

                let currentCalledLen = globalRoom.calledNumbers.length;
                let shouldTriggerWin = (currentCalledLen >= targetCallCount);
                
                if (shouldTriggerWin) {
                    let totalPot = (globalRoom.playersCount || 1) * 10;
                    let prizePerWinner = Math.floor(((totalPot * 0.90) / winnersCount));

                    let primaryCardNum = winningCardNums[0];
                    let winningCardNumbers = getCartelaNumbers(primaryCardNum);
                    let matchedIndices = getWinningMatchedIndices(winningCardNumbers, globalRoom.calledNumbers) || sharedPattern;

                    let winnerNamesStr = winningUsernamesArr.join(', ');
                    let hasRealWinner = winningSocketData.some(i => !i.isBot);
                    
                    winningSocketData.forEach(item => {
                        if (!item.isBot && item.userId) {
                            userWallets[item.userId] = (userWallets[item.userId] || 0) + prizePerWinner;
                        }
                    });

                    sendWinnerNotificationToAdmin(winnerNamesStr, primaryCardNum, prizePerWinner, hasRealWinner);

                    winningSocketData.forEach(item => {
                        if (!item.isBot && item.socketId) {
                            let targetSocket = io.sockets.sockets.get(item.socketId);
                            if (targetSocket) {
                                targetSocket.emit('rewardPrize', { prize: prizePerWinner, balance: userWallets[item.userId] });
                            }
                        }
                    });

                    io.emit('bingoWinner', {
                        username: winnerNamesStr,
                        userId: winningSocketData.find(i => !i.isBot)?.socketId || null,
                        cardNum: primaryCardNum,
                        prize: prizePerWinner,
                        calledNumbers: globalRoom.calledNumbers,
                        matchedIndices: matchedIndices,
                        winnersCount: winnersCount,
                        playersCount: globalRoom.playersCount
                    });

                    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    
                    setTimeout(() => { endRoundAndRestart(); }, 6000);
                    return;
                }

                let calledNum;
                if (winNumQueue.length > 0) {
                    calledNum = Number(winNumQueue.shift());
                    let availIdx = availableNumbers.indexOf(calledNum);
                    if (availIdx > -1) availableNumbers.splice(availIdx, 1);
                } else {
                    if (availableNumbers.length > 0) {
                        let candidateIdx = -1;
                        let candidateNum = null;

                        for (let i = 0; i < availableNumbers.length; i++) {
                            let testNum = availableNumbers[i];
                            let wouldRealUserWin = false;

                            let tempCalled = [...globalRoom.calledNumbers, testNum];
                            
                            let realUserCardDanger = false;
                            Object.entries(globalRoom.playerRoundCards).forEach(([sId, pData]) => {
                                if (pData && pData.cards) {
                                    pData.cards.forEach(cNum => {
                                        let cList = getCartelaNumbers(cNum);
                                        let matched = getWinningMatchedIndices(cList, tempCalled);
                                        if (matched) wouldRealUserWin = true;

                                        let remCount = getRemainingCountForCard(cList, tempCalled);
                                        if (remCount === 1) {
                                            realUserCardDanger = true;
                                        }
                                    });
                                }
                            });

                            if (!wouldRealUserWin && !realUserCardDanger) {
                                candidateIdx = i;
                                candidateNum = testNum;
                                break;
                            }
                        }

                        if (candidateIdx > -1) {
                            calledNum = availableNumbers.splice(candidateIdx, 1)[0];
                        } else {
                            let randIdx = Math.floor(Math.random() * availableNumbers.length);
                            calledNum = availableNumbers.splice(randIdx, 1)[0];
                        }
                    } else {
                        calledNum = Math.floor(Math.random() * 75) + 1;
                    }
                }

                if (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                    globalRoom.calledNumbers.push(Number(calledNum));
                    globalRoom.lastCalledNumber = Number(calledNum);

                    io.emit('numberCalled', {
                        number: Number(calledNum),
                        calledNumbers: globalRoom.calledNumbers
                    });
                    io.emit('numberCalledBroadcast', Number(calledNum));
                }

            }, 4500); 
        }
    }, 1000);
}

function endRoundAndRestart() {
    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    globalRoom.gameActive = false;
    globalRoom.calledNumbers = []; 
    globalRoom.lastCalledNumber = null;
    
    globalRoom.playerRoundCards = {}; 
    globalRoom.playerTemporaryCards = {};
    globalRoom.takenCards = [];

    globalRoom.gameStartTime = Date.now() + 60000; 
    globalRoom.forcedWinningCardNums = [];
    
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
                
                let nowTs = Date.now();
                Object.keys(pendingRequests).forEach(k => {
                    if (nowTs - pendingRequests[k].timestamp > 86400000) {
                        delete pendingRequests[k];
                    }
                });

                if (update.message && update.message.text) {
                    let msgText = update.message.text.trim();
                    let senderChatId = String(update.message.chat.id);
                    
                    if (ADMIN_CHAT_IDS.includes(senderChatId)) {
                        let parts = msgText.split(' ');
                        let cmd = parts[0].toLowerCase();
                        let targetUserId = parts[1] ? String(parts[1]).trim() : null;

                        if ((cmd === '/bonus20' || cmd === '/bonus50') && targetUserId) {
                            let bonusAmount = cmd === '/bonus20' ? 20 : 50;
                            
                            userWallets[targetUserId] = (userWallets[targetUserId] || 0) + bonusAmount;

                            let targetUserSocketObj = onlineRealUsers.find(u => u.userId === targetUserId);
                            let bonusPayload = {
                                type: 'bonus',
                                amount: bonusAmount,
                                adjustedAmount: bonusAmount,
                                balance: userWallets[targetUserId]
                            };

                            if (targetUserSocketObj) {
                                let targetSocket = io.sockets.sockets.get(targetUserSocketObj.socketId);
                                if (targetSocket) {
                                    targetSocket.emit('financialApproved', bonusPayload);
                                    
                                    for (let adminChatId of ADMIN_CHAT_IDS) {
                                        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                            chat_id: adminChatId,
                                            text: `✅ በተሳካ ሁኔታ ለዩዘር ID: \`${targetUserId}\` የ **${bonusAmount} ብር** ቦነስ ተልኳል! (አካውንቱ ላይ ገቢ ሆኗል)`,
                                            parse_mode: 'Markdown'
                                        }).catch(() => {});
                                    }
                                }
                            } else {
                                if (!offlineApprovedQueue[targetUserId]) {
                                    offlineApprovedQueue[targetUserId] = [];
                                }
                                offlineApprovedQueue[targetUserId].push(bonusPayload);

                                for (let adminChatId of ADMIN_CHAT_IDS) {
                                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                        chat_id: adminChatId,
                                        text: `📌 ዩዘር ID: \`${targetUserId}\` ኦንላይን አይደለም። አፕ ሲከፍት ቦነሱ በራስ-ሰር አካውንቱ ላይ ይገባል!`,
                                        parse_mode: 'Markdown'
                                    }).catch(() => {});
                                }
                            }
                        }
                    }
                }

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
                        let reqType = String(reqData.type || 'deposit').toLowerCase().trim();
                        let rawAmount = Number(reqData.amount) || 0;
                        let finalAmountForClient = (reqType === 'withdraw' || reqType === 'withdrawal') ? -Math.abs(rawAmount) : Math.abs(rawAmount);

                        if (action === 'app') {
                            if (reqType === 'deposit' || reqType === 'bonus') {
                                userWallets[reqData.userId] = (userWallets[reqData.userId] || 0) + Math.abs(rawAmount);
                            } else if (reqType === 'withdraw' || reqType === 'withdrawal') {
                                userWallets[reqData.userId] = (userWallets[reqData.userId] || 0) - Math.abs(rawAmount);
                            }

                            let successPayload = { 
                                type: reqData.type, 
                                amount: rawAmount, 
                                adjustedAmount: finalAmountForClient,
                                balance: userWallets[reqData.userId]
                            };

                            if (targetSocket) {
                                targetSocket.emit('financialApproved', successPayload);
                            } else {
                                if (!offlineApprovedQueue[reqData.userId]) {
                                    offlineApprovedQueue[reqData.userId] = [];
                                }
                                offlineApprovedQueue[reqData.userId].push(successPayload);
                            }

                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር - ${reqData.username} - አካውንቱ ላይ ገቢ ሆኗል)`, parse_mode: 'Markdown'
                            }).catch(() => {});
                        } else {
                            if (reqData.chatId) {
                                let rejectMsg = `❌ *AZ BINGO - የገንዘብ ጥያቄዎ ተሰርዟል!*\n\nሰላም *${reqData.username}*፣ የጠየቁት የክፍያ ጥያቄ (${reqData.amount} ብር) በአድሚኑ ተሰርዟል። 🙏`;
                                
                                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                    chat_id: reqData.chatId,
                                    text: rejectMsg,
                                    parse_mode: 'Markdown'
                                }).catch(() => {});
                            }

                            if (targetSocket) { 
                                targetSocket.emit('financialRejected', { type: reqData.type, amount: rawAmount }); 
                            }
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `❌ *ጥያቄው ተሰርዟል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            }).catch(() => {});
                        }
                        delete pendingRequests[requestId]; 
                    }
                    try { 
                        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: callbackQuery.id }); 
                    } catch (e) {}
                }
            }
        }
    } catch (err) {}
    setTimeout(pollTelegramUpdates, 1000);
}
setTimeout(pollTelegramUpdates, 2000);

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_IDS.length) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}`;
    if (receipt) message += `\n\n📄 *ደረሰኝ / SMS:*\n\`${receipt}\``;
    
    for (let adminChatId of ADMIN_CHAT_IDS) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: adminChatId, text: message, parse_mode: 'Markdown',
                reply_markup: { 
                    inline_keyboard: [
                        [
                            { text: "✅ አጽድቅ", callback_data: "app_" + requestId }, 
                            { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }
                        ]
                    ] 
                }
            });
        } catch (error) {}
    }
}

io.on('connection', (socket) => {
    connectedRealPlayers.push(socket.id);
    updateRoomPlayersAndPot();
    socket.emit('syncGameState', globalRoom);
    refreshTakenCardsList();

    socket.emit('financialLockStatus', { isDepositLocked, isWithdrawLocked });

    socket.on('registerRealUser', (userData) => {
        if (userData && userData.userId) {
            let userId = String(userData.userId);
            
            allRegisteredUsers.add(userId);

            if (!userWallets[userId]) {
                userWallets[userId] = 0;
            }

            if (globalRoom.gameActive) {
                let existingKey = Object.keys(globalRoom.playerRoundCards).find(sId => globalRoom.playerRoundCards[sId].userId === userId);
                if (existingKey) {
                    let existingData = globalRoom.playerRoundCards[existingKey];
                    delete globalRoom.playerRoundCards[existingKey];
                    globalRoom.playerRoundCards[socket.id] = existingData;
                }
            } else {
                Object.keys(globalRoom.playerRoundCards).forEach(sId => {
                    if (globalRoom.playerRoundCards[sId].userId === userId) {
                        delete globalRoom.playerRoundCards[sId];
                    }
                });
            }

            delete globalRoom.playerTemporaryCards[socket.id];

            onlineRealUsers = onlineRealUsers.filter(u => u.userId !== userId);
            onlineRealUsers.push({ socketId: socket.id, userId: userId, username: userData.username || 'No Username', fullName: userData.fullName || 'ተጫዋች' });
            
            if (!claimedWelcomeBonusUsers.has(userId)) {
                claimedWelcomeBonusUsers.add(userId);
                userWallets[userId] += 20;
                socket.emit('welcomeBonusGranted', { 
                    amount: 20, 
                    balance: userWallets[userId],
                    message: "እንኳን ደህና መጡ! የመጀመሪያ የአንድ ጊዜ የ20 ብር ቦነስ ተሰጥቷል!" 
                });
            }

            if (offlineApprovedQueue[userId] && offlineApprovedQueue[userId].length > 0) {
                offlineApprovedQueue[userId].forEach(item => {
                    socket.emit('financialApproved', item);
                });
                delete offlineApprovedQueue[userId];
            }

            socket.emit('updateBalance', { balance: userWallets[userId] });

            refreshTakenCardsList();
            updateRoomPlayersAndPot();
            socket.emit('syncGameState', globalRoom);
        }
    });

    socket.on('getAdminRealUsers', () => {
        socket.emit('adminRealUsersListUpdate', onlineRealUsers);
    });

    socket.on('adminToggleLock', (data) => {
        if (data.type === 'deposit') {
            isDepositLocked = data.locked;
        } else if (data.type === 'withdraw') {
            isWithdrawLocked = data.locked;
        }
        io.emit('financialLockStatus', { isDepositLocked, isWithdrawLocked });
        socket.emit('adminLockResponse', { success: true, message: `✅ የተሳካ ሁኔታ ተቀይሯል!` });
    });

    socket.on('adminSendBonus', (data) => {
        if (socket.id) {
            let targetUserId = String(data.targetUserId).trim();
            let bonusAmount = Number(data.amount) || 20;

            userWallets[targetUserId] = (userWallets[targetUserId] || 0) + bonusAmount;

            let bonusPayload = {
                type: 'bonus',
                amount: bonusAmount,
                adjustedAmount: bonusAmount,
                balance: userWallets[targetUserId]
            };

            let targetUserSocketObj = onlineRealUsers.find(u => u.userId === targetUserId);
            if (targetUserSocketObj) {
                let targetSocket = io.sockets.sockets.get(targetUserSocketObj.socketId);
                if (targetSocket) {
                    targetSocket.emit('financialApproved', bonusPayload);
                    socket.emit('adminBonusResponse', { success: true, message: `✅ ለዩዘር ID (${targetUserId}) ${bonusAmount} ብር ቦነስ ተልኮ አካውንቱ ላይ ገቢ ሆኗል!` });
                }
            } else {
                if (!offlineApprovedQueue[targetUserId]) {
                    offlineApprovedQueue[targetUserId] = [];
                }
                offlineApprovedQueue[targetUserId].push(bonusPayload);
                socket.emit('adminBonusResponse', { success: true, message: `📌 ዩዘሩ ኦንላይን አይደለም። አፕ ሲከፍት የ ${bonusAmount} ብር ቦነሱ በራስ-ሰር አካውንቱ ላይ ይገባል!` });
            }
        }
    });

    socket.on('adminBroadcastMessage', async (data) => {
        let messageText = data ? data.message : null;
        
        if (!messageText) {
            socket.emit('adminBroadcastResponse', { success: false, message: "⚠️ እባክዎ የሚላከውን መልእክት ይጻፉ!" });
            return;
        }

        let successCount = 0;
        let allUserIds = [...allRegisteredUsers];

        (async () => {
            for (let uId of allUserIds) {
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: uId,
                        text: `📢 *AZ BINGO - ማስታወቂያ*\n\n${messageText}`,
                        parse_mode: 'Markdown'
                    });
                    successCount++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {}
            }
        })();

        socket.emit('adminBroadcastResponse', { 
            success: true, 
            message: `✅ ማስታወቂያው ለተጠቃሚዎች በሂደት ላይ ይላካል! (አጠቃላይ ተመዝጋቢዎች: ${allUserIds.length})` 
        });
    });

    socket.on('tempSelectCards', (cards) => {
        if (Array.isArray(cards)) {
            globalRoom.playerTemporaryCards[socket.id] = cards;
            refreshTakenCardsList();
        }
    });

    socket.on('confirmCards', (data) => {
        if (data && data.cards && Array.isArray(data.cards)) {
            globalRoom.playerRoundCards[socket.id] = {
                cards: data.cards,
                username: data.username || 'ተጫዋች',
                userId: data.userId || 'unknown'
            };
            if (globalRoom.playerTemporaryCards[socket.id]) {
                delete globalRoom.playerTemporaryCards[socket.id];
            }
            refreshTakenCardsList();
            updateRoomPlayersAndPot();
            socket.emit('cardSelectionSuccess');
        }
    });

    socket.on('adminSetNextWinner', (data) => {
        let winnerType = data.winnerType ? String(data.winnerType).trim() : null;
        
        if (winnerType === 'only_real_users_mode') {
            enableOnlyRealUsersMode = true;
            forcedNextWinner = 'random_real';
            updateRoomPlayersAndPot();
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [ሪል ዩዘሮች ብቻ - True Random] ተቀይሯል!` });
        } else if (winnerType === 'standard_bot_mode') {
            enableOnlyRealUsersMode = false;
            forcedNextWinner = null;
            updateRoomPlayersAndPot();
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [መደበኛ (ቦቶች + ሪል)] ተመለሰ!` });
        } else {
            forcedNextWinner = winnerType;
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
        }
    });

    socket.on('financialRequest', async (data) => {
        data.type = data.type || 'deposit';
        let { type, amount, username, userId, currentBalance, phone, receipt, telegramChatId } = data;
        
        if (type === 'deposit' && isDepositLocked) {
            socket.emit('financialError', { message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
            return;
        }
        if ((type === 'withdraw' || type === 'withdrawal') && isWithdrawLocked) {
            socket.emit('financialError', { message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
            return;
        }

        let requestId = 'req_' + socket.id.substring(0, 5) + '_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        
        pendingRequests[requestId] = { 
            userId: String(userId || 'unknown'), 
            chatId: telegramChatId || userId, 
            type, 
            amount, 
            username, 
            socketId: socket.id, 
            timestamp: Date.now() 
        };

        await sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    });

    socket.on('disconnect', () => {
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        onlineRealUsers = onlineRealUsers.filter(u => u.socketId !== socket.id);
        
        if (!globalRoom.gameActive) {
            delete globalRoom.playerRoundCards[socket.id];
        }
        delete globalRoom.playerTemporaryCards[socket.id];
        
        refreshTakenCardsList();
        updateRoomPlayersAndPot();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Server running on port " + PORT);
});
