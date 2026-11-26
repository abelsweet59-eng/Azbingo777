const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8
});

app.express = express;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
const ADMIN_CHAT_IDS = ["371093083", "7906963841"];

const claimedWelcomeBonusUsers = new Set();
const userWallets = {};
const allRegisteredUsers = new Set();

const registeredUserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
});

const RegisteredUser = mongoose.models.RegisteredUser || mongoose.model('RegisteredUser', registeredUserSchema);

const userWalletSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

const UserWallet = mongoose.models.UserWallet || mongoose.model('UserWallet', userWalletSchema);

const welcomeBonusClaimedSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    claimedAt: { type: Date, default: Date.now }
});

const WelcomeBonusClaimed = mongoose.models.WelcomeBonusClaimed || mongoose.model('WelcomeBonusClaimed', welcomeBonusClaimedSchema);
const MONGODB_URI = process.env.MONGODB_URI;

async function markWelcomeBonusClaimed(userId) {
    if (!userId) return;
    const cleanId = String(userId).trim();
    if (!cleanId) return;

    claimedWelcomeBonusUsers.add(cleanId);

    if (MONGODB_URI && mongoose.connection.readyState === 1) {
        try {
            await WelcomeBonusClaimed.updateOne(
                { userId: cleanId },
                { $setOnInsert: { userId: cleanId, claimedAt: new Date() } },
                { upsert: true }
            );
        } catch (e) {}
    }
}

async function loadClaimedWelcomeBonusUsersFromDb() {
    if (!MONGODB_URI || mongoose.connection.readyState !== 1) return;
    try {
        const docs = await WelcomeBonusClaimed.find({}, { userId: 1, _id: 0 }).lean();
        docs.forEach(d => {
            if (d && d.userId) {
                claimedWelcomeBonusUsers.add(String(d.userId).trim());
            }
        });
    } catch (e) {}
}

async function saveWalletToDb(userId, balance) {
    if (!userId) return;
    const cleanId = String(userId).trim();
    if (!cleanId) return;
    const cleanBal = Number((Number(balance) || 0).toFixed(2));

    if (MONGODB_URI && mongoose.connection.readyState === 1) {
        try {
            await UserWallet.updateOne(
                { userId: cleanId },
                { $set: { balance: cleanBal, updatedAt: new Date() } },
                { upsert: true }
            );
        } catch (e) {}
    }
}

async function setWalletBalance(userId, newBalance) {
    if (!userId) return 0;
    const cleanId = String(userId).trim();
    const cleanBal = Number(Math.max(0, Number(newBalance) || 0).toFixed(2));
    userWallets[cleanId] = cleanBal;
    await saveWalletToDb(cleanId, cleanBal);
    return cleanBal;
}

async function loadWalletsFromDb() {
    if (!MONGODB_URI || mongoose.connection.readyState !== 1) return;
    try {
        const walletDocs = await UserWallet.find({}, { userId: 1, balance: 1, _id: 0 }).lean();
        walletDocs.forEach(w => {
            if (w && w.userId) {
                const cleanId = String(w.userId).trim();
                const parsedBal = Number(w.balance);
                userWallets[cleanId] = Number.isFinite(parsedBal) ? Number(parsedBal.toFixed(2)) : 0;
            }
        });
    } catch (e) {}
}

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(async () => {
            console.log("✅ Connected to MongoDB Atlas");
            const docs = await RegisteredUser.find({}, { userId: 1, _id: 0 }).lean();
            docs.forEach(d => {
                if (d.userId) allRegisteredUsers.add(String(d.userId));
            });
            await loadWalletsFromDb();
            await loadClaimedWelcomeBonusUsersFromDb();
        })
        .catch(err => console.error("❌ MongoDB connection error:", err.message));
}

async function addUserToDbAndSet(rawId) {
    if (!rawId) return;
    const cleanId = String(rawId).trim();
    if (!/^\d+$/.test(cleanId)) return;

    allRegisteredUsers.add(cleanId);

    if (MONGODB_URI && mongoose.connection.readyState === 1) {
        try {
            await RegisteredUser.updateOne(
                { userId: cleanId },
                { $setOnInsert: { userId: cleanId } },
                { upsert: true }
            );
        } catch (e) {}
    }
}

const userReferrers = {};
const referralEarnings = {};
const userLastRequestTimeMap = {};

let isDepositLocked = false;
let isWithdrawLocked = false;
let isFinishingRound = false;

const configFilePath = path.join(__dirname, 'telebirr_config.json');
let telebirrConfig = {
    phone: "0940272544",
    name: "Abel"
};

if (fs.existsSync(configFilePath)) {
    try {
        let savedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        if (savedConfig.phone) telebirrConfig.phone = savedConfig.phone;
        if (savedConfig.name) telebirrConfig.name = savedConfig.name;
    } catch (e) {}
}

function saveTelebirrConfigToDisk() {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(telebirrConfig, null, 2));
    } catch (e) {}
}

const botConfigFilePath = path.join(__dirname, 'bot_config.json');
let botConfig = {
    minBots: 7,
    maxBots: 370
};

if (fs.existsSync(botConfigFilePath)) {
    try {
        let savedBotConfig = JSON.parse(fs.readFileSync(botConfigFilePath, 'utf8'));
        if (savedBotConfig.minBots !== undefined) botConfig.minBots = Number(savedBotConfig.minBots);
        if (savedBotConfig.maxBots !== undefined) botConfig.maxBots = Number(savedBotConfig.maxBots);
    } catch (e) {}
}

function saveBotConfigToDisk() {
    try {
        fs.writeFileSync(botConfigFilePath, JSON.stringify(botConfig, null, 2));
    } catch (e) {}
}

const baseNumberFlowSequence = [
    12, 14, 16, 18, 20, 15, 17, 14, 19, 20, 18, 16, 15, 17, 19, 18, 20, 17, 16, 18,
    16, 14, 18, 20, 22, 24, 17, 18, 16, 18, 19, 11, 10, 20, 19, 18, 21, 20, 16, 21,
    19, 18, 20, 16, 19, 18, 16, 17, 16, 20, 19, 16, 18, 20, 17, 19, 18, 16, 19, 22,
    21, 17, 19, 18, 16, 17, 18, 16, 20, 19, 18, 18, 20, 19, 18, 19, 16, 17, 17, 20,
    18, 13
];
let sequenceIndex = 0;

const ETHIOPIAN_BOT_NAMES = [
    "bebaw", "ማርታ", "asrat00", "Melaku tamrat", "በላይ",
    "kesho", "አብይ", "hamud", "Helen hilu", "ali ali",
    "aste19", "nati47", "Nati bonga", "kida7k", "ማርቆስ",
    "natinati", "goshu", "Elias tilahun", "gadeion", "አሰፋ",
    "aster asta", "yonasjo", "Amina", "temesgen19", "የኔ",
    "ቤላ", "Dawit Mohamed", "ጥላሁን", "sani", "Babi",
    "eyobeyob", "0947151407", "halal", "Netsanet", "ebrahim ebra",
    "Henok", "Dani", "sami Getachew", "Pnp", "Anwar",
    "Naughty By nature", "Ñãtåñ......", "Online", "kali", "Mohammedsani Sulitan",
    "Wubamlak Belste", "Lina Habtamu", "Nimo", "ፈ-ሺ", "Šà¥¢ø Qü€€ñ",
    "Beki", "syf", "Xo", "Time Of", "§mrĕţ",
    "L F U", "sosi", "Mawlati_ahmed", "Megdi", "Sittina",
    "Ibro", "Cr7", "Frew", "Quarezma", "ስንታየሁ",
    "Dibora", "Osmhen", "Chala", "Surafel", "Abela_man",
    "Zehara", "Worku", "Fiyorina", "Kirra", "Bilal",
    "Huzefa_jimma_jøey", "Pilatos", "Merlin", "Osmehin", "Denver",
    "Belew", "Jilalu", "Gizachew Kassahun", "bereket dagne", "Mesfin",
    "ሞለፍን ኔትስት ገበየሁ", "Birukte#🦋", "ንስር", "🦋Meklit🦋", "Abel x",
    "Farhewot Yashtla", "🅖ⓞⓞⓓ🌹", "YO", "እያሱ", "Goyta Miraw ጣምራው",
    "0919091129", "Gdg", "Mohammed_tesema", "Lai", "Sintayehu Getachew",
    "Pipo Kassa", "ገብርኤል አባቴ", "Yohannes Ng", "Gech man", "Devido ✝",
    "Seydou Kamite", "Mamush Kasim Mucaa Kakuuuu", "Robel_tullu", "Aman yi", "Ahmed Basher",
    "Wenda last King", "Abonesh Kinfu", "Lij yalfex jinka 🫅", "Big Boss 💪", "Firde Nigus",
    "ANIE X YUKKI", "Girum Edeshawu", "Bini Teketele", "Abdella Mohammed Ebrahim", "Asbada Abubakar",
    "Ebrahim M/d Ebrahim", "Abdu Shekna", "Abdujalil Ahmed Detolale", "Mugabe_abate", "urjii 🥷",
    "Amoo", "Assistant 2", "Anu 28", "ማኅበል", "Yd",
    "Girmay Nigus", "Yohannes", "H 5", "አበነህ 💕💕💕", "Tolosa",
    "Kejelcha Mamo", "Ashagre", "Ed", "Gedefaw Aseffa", "D 7",
    "Getachew", "Tamirat Girma", "Ashenafi", "Dada", "Demsash",
    "ድር ድር", "አፒው", "Ahadi Ahemed", "skat mamaniyø", "tamirat",
    "kasu", "PPP😋69", "Ad la", "Astu Bast", "getesh aresenal",
    "WALEX JOSEF", "Habet", "♠[$]♠", "Ratum yasın", "ˋHEER X MUSICˎ",
    "Alemayehu Tesema", "habtu moges", "‖꧁Tame꧂‖", "Alexs Kebede", "Dagna King",
    "Haileyesus_Geremew", "Chicken Road", "nal", "Wase", "Y@imam",
    "Current thing", "Wizzy", "weyn Ter", "Tedi", "Tame 😍",
    "Fenaan_Fenaan", "Barbaadi", "Fire Tesfaye", "Samii", "Tesfaye_Asnake",
    "Teg_0920", "Mitiku57 Kibatu", "yohannes online", "Melkamnew", "L14",
    "Terryson Cruzman", "Teddy", "kefle birhane", "Abushi 💀💀", "Yonase Tesema",
    "Mulugeta Fantahun", "Kifle Møk", "Pro max", "Nscros", "የማርያም",
    "አቤል", "Tloya", "ተሜ", "bakle", "ናቲና",
    "Dj", "wanaw", "Falcon", "Dawit", "Ermias_99",
    "Solomon", "Bethel_M", "Miki_Bingo", "Hanna", "Natnael",
    "Kidist", "Bereket", "Samson_tefera", "Yordanos", "Feven_A",
    "Henok_Z", "Meron", "Rediet", "Abel_kassu", "Tsion",
    "Brook", "Lidya", "Michael", "Nahom", "Rut_K",
    "Robel", "Tigist", "Biniyam", "Kalkidan", "Ephrem",
    "Rahel", "Yonas", "Semhar", "አበበ", "መርየም",
    "ጌታቸው", "ሰሎሞን", "መሳይ", "ዮሐንስ", "አንዋር", "ፈቀደ",
    "ምህረት", "ተስፋዬ", "አንለይ", "ፍቅሩ", "እዮብ",
    "አማኑኤል", "ኤልያስ", "ብርሃኑ", "ታደሰ", "መኮንን",
    "ጌታነህ", "ሰለሞን", "አበራ", "ተክሌ", "መላኩ", "አምሳሉ",
    "በለጠ", "ተፈራ", "እንዳለ", "ኃይሌ", "በቀለ", "ደሳለኝ",
    "መሰለ", "አለሙ", "ተገኝ", "ከበደ", "አሰፋ"
];

const WINNING_LINES_ALL = [
    [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
    [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
    [0,6,12,18,24], [4,8,12,16,20],
    [0,4,20,24]
];

const MAX_ALLOWED_HITS_PER_LINE = 2;
const MAX_STANDARD_BOT_CALLS = 18;
const EMPTY_CARD_GRACE_MS = 1500;

function getRandomBotNames(count) {
    let shuffled = [...ETHIOPIAN_BOT_NAMES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + 60000,
    emptyCardGraceUntil: 0,
    playersCount: 140,
    lockedRoundPlayersCount: null,
    lockedRoundPrize: null,
    takenCards: [],
    botTakenCards: [],
    playerRoundCards: {},
    playerTemporaryCards: {},
    lastCalledNumber: null,
    targetWinCallCount: 12,
    forcedWinningCardNums: [],
    allowRealWinnerThisRound: false
};

let forcedNextWinner = null;
let enableOnlyRealUsersMode = false;
let onlineRealUsers = [];
let pendingRequests = {};
let offlineApprovedQueue = {};
let gameInterval = null;
let numberCallInterval = null;
let winGraceTimeout = null;
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

    for (let r = 0; r < 5; r++) {
        let row = [];
        for (let c = 0; c < 5; c++) {
            let idx = r * 5 + c;
            let val = winningCardNumbers[idx];
            let isHit = (val === "FREE" || cleanCalled.includes(Number(val)));
            row.push({ idx, isHit, val });
        }
        grid2D.push(row);
    }

    for (let r = 0; r < 5; r++) {
        if (grid2D[r].every(cell => cell.isHit)) {
            return grid2D[r].map(cell => cell.idx);
        }
    }

    for (let c = 0; c < 5; c++) {
        let colHits = true;
        let colCells = [];
        for (let r = 0; r < 5; r++) {
            colCells.push(grid2D[r][c]);
            if (!grid2D[r][c].isHit) colHits = false;
        }
        if (colHits) {
            return colCells.map(cell => cell.idx);
        }
    }

    let diag1Hits = true, diag2Hits = true;
    let diag1Cells = [], diag2Cells = [];
    for (let i = 0; i < 5; i++) {
        diag1Cells.push(grid2D[i][i]);
        diag2Cells.push(grid2D[i][4 - i]);
        if (!grid2D[i][i].isHit) diag1Hits = false;
        if (!grid2D[i][4 - i].isHit) diag2Hits = false;
    }
    if (diag1Hits) return diag1Cells.map(cell => cell.idx);
    if (diag2Hits) return diag2Cells.map(cell => cell.idx);

    if (grid2D[0][0].isHit && grid2D[0][4].isHit && grid2D[4][0].isHit && grid2D[4][4].isHit) {
        return [0, 4, 20, 24];
    }

    return null;
}

function getAllRealUserRoundCards() {
    let cardsByUserOrSocket = new Map();

    Object.entries(globalRoom.playerRoundCards).forEach(([socketId, pData]) => {
        if (!pData || !Array.isArray(pData.cards) || pData.cards.length === 0) return;
        let key = pData.userId ? `uid_${String(pData.userId)}` : `sid_${socketId}`;
        let existing = cardsByUserOrSocket.get(key) || new Set();
        pData.cards.forEach(c => existing.add(Number(c)));
        cardsByUserOrSocket.set(key, existing);
    });

    let allCardNums = [];
    cardsByUserOrSocket.forEach(cardSet => {
        cardSet.forEach(c => allCardNums.push(c));
    });
    return allCardNums;
}

function isSafeNumberForRealUsersInBotMode(testNum, currentCalledNumbers) {
    let candidateCalled = [...currentCalledNumbers.map(n => Number(n)), Number(testNum)];
    let realCards = getAllRealUserRoundCards();

    for (let cNum of realCards) {
        let cardList = getCartelaNumbers(cNum);

        for (let line of WINNING_LINES_ALL) {
            let hitCount = 0;
            for (let idx of line) {
                let cellVal = cardList[idx];
                if (cellVal === "FREE" || candidateCalled.includes(Number(cellVal))) {
                    hitCount++;
                }
            }

            if (hitCount >= line.length || hitCount > MAX_ALLOWED_HITS_PER_LINE) {
                return false;
            }
        }
    }

    return true;
}

function announceRandomBotAndFinishRound(preferredCardNum = null, preferredPattern = null) {
    let randomBotName = getRandomBotNames(1)[0];
    let botCardNum = preferredCardNum || (Math.floor(Math.random() * 450) + 1);
    let botCardList = getCartelaNumbers(botCardNum);
    let lineToShow = preferredPattern || WINNING_LINES_ALL[Math.floor(Math.random() * WINNING_LINES_ALL.length)];
    let matched = getWinningMatchedIndices(botCardList, globalRoom.calledNumbers) || lineToShow;

    announceWinnersAndFinish([{
        username: randomBotName,
        socketId: null,
        userId: null,
        isBot: true,
        cardNum: botCardNum,
        matched: matched
    }]);
}

let lastSmoothCount = 95;

function getRealisticBotsCount(realCount, isGameActive = false) {
    if (enableOnlyRealUsersMode) return 0;

    let minB = Number(botConfig.minBots) || 30;
    let maxB = Number(botConfig.maxBots) || 221;
    if (minB > maxB) { let tmp = minB; minB = maxB; maxB = tmp; }

    const now = new Date();
    let utcHours = now.getUTCHours();
    let ethiopianHour = (utcHours + 3) % 24;
    let targetBase = Math.floor((minB + maxB) / 2);

    if (ethiopianHour >= 6 && ethiopianHour < 12) {
        targetBase = minB + Math.floor(Math.random() * Math.max(1, (maxB - minB) * 0.3));
    } else if (ethiopianHour >= 12 && ethiopianHour < 19) {
        let progress = (ethiopianHour - 12) / 7;
        targetBase = Math.floor(minB + (progress * (maxB - minB) * 0.6));
    } else if (ethiopianHour >= 19 || ethiopianHour < 3) {
        targetBase = Math.floor(minB + ((maxB - minB) * 0.7) + Math.random() * Math.max(1, (maxB - minB) * 0.3));
    } else {
        targetBase = minB + Math.floor(Math.random() * Math.max(1, (maxB - minB) * 0.4));
    }

    if (isGameActive) {
        return lastSmoothCount;
    }

    let step = Math.floor(Math.random() * 2) + 1;
    if (lastSmoothCount < targetBase) {
        lastSmoothCount += step;
        if (lastSmoothCount > targetBase) lastSmoothCount = targetBase;
    } else if (lastSmoothCount > targetBase) {
        lastSmoothCount -= step;
        if (lastSmoothCount < targetBase) lastSmoothCount = targetBase;
    } else {
        let minorDelta = (Math.random() < 0.5 ? 1 : -1);
        lastSmoothCount += minorDelta;
    }

    if (lastSmoothCount < minB) lastSmoothCount = minB;
    if (lastSmoothCount > maxB) lastSmoothCount = maxB;

    return lastSmoothCount;
}

function isInEmptyCardGracePeriod() {
    return !globalRoom.gameActive && Date.now() < (globalRoom.emptyCardGraceUntil || 0);
}

function syncBotCardsToPlayersCount() {
    if (enableOnlyRealUsersMode || isInEmptyCardGracePeriod()) {
        globalRoom.botTakenCards = [];
        return;
    }

    let realTakenSet = new Set();
    Object.values(globalRoom.playerRoundCards).forEach(p => {
        if (p && Array.isArray(p.cards)) p.cards.forEach(c => realTakenSet.add(Number(c)));
    });
    Object.values(globalRoom.playerTemporaryCards).forEach(cards => {
        if (Array.isArray(cards)) cards.forEach(c => realTakenSet.add(Number(c)));
    });

    globalRoom.botTakenCards = globalRoom.botTakenCards.filter(c => !realTakenSet.has(Number(c)));

    let targetTotalCards = Math.min(500, Math.max(realTakenSet.size, Number(globalRoom.playersCount) || 0));
    let neededBotCards = Math.max(0, targetTotalCards - realTakenSet.size);

    if (globalRoom.botTakenCards.length > neededBotCards) {
        globalRoom.botTakenCards = globalRoom.botTakenCards.slice(0, neededBotCards);
    }

    if (globalRoom.botTakenCards.length < neededBotCards) {
        let currentTakenSet = new Set([...realTakenSet, ...globalRoom.botTakenCards]);
        let available = [];
        for (let i = 1; i <= 500; i++) {
            if (!currentTakenSet.has(i)) available.push(i);
        }

        let toAddCount = neededBotCards - globalRoom.botTakenCards.length;
        for (let i = 0; i < toAddCount && available.length > 0; i++) {
            let randIdx = Math.floor(Math.random() * available.length);
            let picked = available.splice(randIdx, 1)[0];
            globalRoom.botTakenCards.push(picked);
        }
    }
}

function updateRoomPlayersAndPot(forceBroadcast = true) {
    if (globalRoom.gameActive && globalRoom.lockedRoundPlayersCount !== null) {
        globalRoom.playersCount = globalRoom.lockedRoundPlayersCount;
        if (forceBroadcast) {
            io.emit('updatePlayersCount', {
                playersCount: globalRoom.playersCount,
                prize: globalRoom.lockedRoundPrize,
                locked: true
            });
        }
        return;
    }

    let realCount = connectedRealPlayers.length;
    let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([sId, data]) => data.cards && data.cards.length > 0);

    let uniqueRealCardsCount = 0;
    activeRealEntries.forEach(([sId, data]) => {
        if (data.cards) uniqueRealCardsCount += data.cards.length;
    });

    if (enableOnlyRealUsersMode) {
        globalRoom.playersCount = uniqueRealCardsCount > 0 ? uniqueRealCardsCount : activeRealEntries.length;
        if (globalRoom.playersCount === 0) globalRoom.playersCount = realCount > 0 ? realCount : 1;
    } else {
        let currentBotsCount = getRealisticBotsCount(realCount, false);
        globalRoom.playersCount = Math.min(500, Math.max(1, currentBotsCount + uniqueRealCardsCount));
    }

    let currentPrize = Math.floor((globalRoom.playersCount * 10) * 0.90);

    if (forceBroadcast) {
        io.emit('updatePlayersCount', {
            playersCount: globalRoom.playersCount,
            prize: currentPrize,
            locked: false
        });
        refreshTakenCardsList();
    }
}

setInterval(() => {
    if (!globalRoom.gameActive) {
        updateRoomPlayersAndPot(true);
    }
}, 4000);

function refreshTakenCardsList() {
    if (isInEmptyCardGracePeriod()) {
        globalRoom.botTakenCards = [];
        globalRoom.takenCards = [];
        io.emit('updateTakenCards', []);
        return;
    }

    syncBotCardsToPlayersCount();

    let allTaken = [...globalRoom.botTakenCards];
    Object.values(globalRoom.playerRoundCards).forEach(p => {
        if (p && Array.isArray(p.cards)) allTaken.push(...p.cards.map(Number));
    });
    Object.values(globalRoom.playerTemporaryCards).forEach(cards => {
        if (Array.isArray(cards)) allTaken.push(...cards.map(Number));
    });
    globalRoom.takenCards = Array.from(new Set(allTaken));
    io.emit('updateTakenCards', globalRoom.takenCards);
}

function simulateBotCardSelections() {
    if (globalRoom.gameActive || enableOnlyRealUsersMode || isInEmptyCardGracePeriod()) return;
    refreshTakenCardsList();
}

setInterval(simulateBotCardSelections, 6000);

async function sendWinnerNotificationToAdmin(winnerNamesStr, cardNum, prizePerWinner, isRealUser, playersCountForRound) {
    if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_IDS.length || !isRealUser) return;
    let message = `🏆 *AZ BINGO - 👤 አሸናፊ(ዎች)*\n\n🎉 አሸናፊዎች: *${winnerNamesStr}*\n🔢 ዋና ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው የድርሻ ብር (ለእያንዳንዱ): *${prizePerWinner} ብር*\n👥 ተጫዋቾች ብዛት: ${playersCountForRound}`;

    for (let adminChatId of ADMIN_CHAT_IDS) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                chat_id: adminChatId, text: message, parse_mode: 'Markdown'
            });
        } catch (error) {}
    }
}

async function announceWinnersAndFinish(winnersDataList) {
    if (!globalRoom.gameActive || isFinishingRound) return;
    isFinishingRound = true;
    globalRoom.gameActive = false;

    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    if (winGraceTimeout) { clearTimeout(winGraceTimeout); winGraceTimeout = null; }

    let sanitizedWinners = Array.isArray(winnersDataList) ? [...winnersDataList] : [];

    if (!enableOnlyRealUsersMode && !globalRoom.allowRealWinnerThisRound) {
        sanitizedWinners = sanitizedWinners.filter(w => w.isBot === true);
        if (sanitizedWinners.length === 0) {
            let fallbackBotName = getRandomBotNames(1)[0];
            let fallbackCard = Math.floor(Math.random() * 450) + 1;
            let fallbackCardList = getCartelaNumbers(fallbackCard);
            let fallbackLine = WINNING_LINES_ALL[Math.floor(Math.random() * WINNING_LINES_ALL.length)];
            sanitizedWinners.push({
                username: fallbackBotName,
                socketId: null,
                userId: null,
                isBot: true,
                cardNum: fallbackCard,
                matched: getWinningMatchedIndices(fallbackCardList, globalRoom.calledNumbers) || fallbackLine
            });
        }
    }

    let primaryWinner = sanitizedWinners[0];
    let primaryCardNum = primaryWinner.cardNum;
    let matchedIndices = primaryWinner.matched;
    let winnerNamesStr = sanitizedWinners.map(w => w.username).join(', ');
    let winnersCount = sanitizedWinners.length;

    let roundPlayersCount = globalRoom.lockedRoundPlayersCount || globalRoom.playersCount || 1;
    let roundTotalPrize = globalRoom.lockedRoundPrize !== null
        ? globalRoom.lockedRoundPrize
        : Math.floor((roundPlayersCount * 10) * 0.90);
    let prizePerWinner = Math.floor(roundTotalPrize / winnersCount);
    let hasRealWinner = sanitizedWinners.some(w => !w.isBot);

    for (let w of sanitizedWinners) {
        if (!w.isBot && w.userId) {
            let nextBal = Number(((userWallets[w.userId] || 0) + prizePerWinner).toFixed(2));
            await setWalletBalance(w.userId, nextBal);
        }
    }

    sendWinnerNotificationToAdmin(winnerNamesStr, primaryCardNum, prizePerWinner, hasRealWinner, roundPlayersCount);

    sanitizedWinners.forEach(w => {
        if (!w.isBot && w.socketId) {
            let targetSocket = io.sockets.sockets.get(w.socketId);
            if (targetSocket) {
                targetSocket.emit('rewardPrize', { prize: prizePerWinner, balance: userWallets[w.userId] });
            }
        }
    });

    io.emit('bingoWinner', {
        username: winnerNamesStr,
        userId: sanitizedWinners.find(w => !w.isBot)?.socketId || null,
        cardNum: primaryCardNum,
        prize: prizePerWinner,
        calledNumbers: globalRoom.calledNumbers,
        matchedIndices: matchedIndices,
        winnersCount: winnersCount,
        playersCount: roundPlayersCount
    });

    setTimeout(() => { endRoundAndRestart(); }, 6000);
}

function startMainGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
    globalRoom.gameStartTime = Date.now() + 60000;

    gameInterval = setInterval(() => {
        let timeLeft = globalRoom.gameStartTime - Date.now();

        if (timeLeft <= 0 && !globalRoom.gameActive && !isFinishingRound) {
            globalRoom.gameActive = true;
            globalRoom.emptyCardGraceUntil = 0;
            globalRoom.calledNumbers = [];
            globalRoom.lastCalledNumber = null;

            updateRoomPlayersAndPot(false);
            let startPlayersCount = Math.max(1, Number(globalRoom.playersCount) || 1);
            let startTotalPrize = Math.floor((startPlayersCount * 10) * 0.90);

            globalRoom.lockedRoundPlayersCount = startPlayersCount;
            globalRoom.lockedRoundPrize = startTotalPrize;
            globalRoom.playersCount = startPlayersCount;

            io.emit('updatePlayersCount', {
                playersCount: globalRoom.lockedRoundPlayersCount,
                prize: globalRoom.lockedRoundPrize,
                locked: true
            });

            let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
            let currentWinnerType = forcedNextWinner;
            forcedNextWinner = null;

            if (enableOnlyRealUsersMode) {
                globalRoom.allowRealWinnerThisRound = true;
                let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
                availableNumbers.sort(() => 0.5 - Math.random());

                io.emit('gameStarted', {
                    calledNumbers: [],
                    playersCount: globalRoom.lockedRoundPlayersCount,
                    prize: globalRoom.lockedRoundPrize
                });
                io.emit('gameStartedBroadcast');

                if (numberCallInterval) clearInterval(numberCallInterval);

                numberCallInterval = setInterval(() => {
                    if (!globalRoom.gameActive || isFinishingRound) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        return;
                    }

                    if (availableNumbers.length === 0 || globalRoom.calledNumbers.length >= 75) {
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
                                        matched: matched
                                    });
                                }
                            });
                        }
                    });

                    if (winningWinnersList.length > 0) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        winGraceTimeout = setTimeout(() => {
                            announceWinnersAndFinish(winningWinnersList);
                        }, 6000);
                    }

                }, 5500);

                return;
            }

            let winningUsernamesArr = [];
            let winningSocketData = [];
            let winnersCount = 1;
            let winningCardNums = [];

            let targetRealCount = 0;
            let explicitRealForced = (
                currentWinnerType === 'only_real_users' ||
                currentWinnerType === 'random_real' ||
                currentWinnerType === 'random_3_real' ||
                currentWinnerType === 'multi_real_3' ||
                currentWinnerType === 'real_user' ||
                currentWinnerType === 'single_real'
            );

            globalRoom.allowRealWinnerThisRound = Boolean(explicitRealForced && activeRealEntries.length > 0);

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

            let targetCallCount = Math.max(6, baseNumberFlowSequence[sequenceIndex]);
            sequenceIndex = (sequenceIndex + 1) % baseNumberFlowSequence.length;

            let possiblePatterns = [...WINNING_LINES_ALL];
            let sharedPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];

            let primaryCardList = getCartelaNumbers(winningCardNums[0]);
            let primaryPatternNumbers = sharedPattern
                .map(idx => primaryCardList[idx])
                .filter(n => n !== "FREE")
                .map(n => Number(n));

            let shuffledPatternNums = [...primaryPatternNumbers].sort(() => 0.5 - Math.random());
            let finalWinningBall = shuffledPatternNums.pop();
            let earlyPatternBalls = shuffledPatternNums;

            let availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
            availableNumbers.sort(() => 0.5 - Math.random());

            availableNumbers = availableNumbers.filter(n => !primaryPatternNumbers.includes(n));

            let totalPreCalls = Math.min(MAX_STANDARD_BOT_CALLS, Math.max(earlyPatternBalls.length, targetCallCount - 1));
            let preCallSchedule = new Array(totalPreCalls).fill(null);

            let slotIndices = Array.from({ length: totalPreCalls }, (_, i) => i).sort(() => 0.5 - Math.random());
            earlyPatternBalls.forEach((ball, i) => {
                if (i < slotIndices.length) {
                    preCallSchedule[slotIndices[i]] = ball;
                }
            });

            io.emit('gameStarted', {
                calledNumbers: [],
                playersCount: globalRoom.lockedRoundPlayersCount,
                prize: globalRoom.lockedRoundPrize
            });
            io.emit('gameStartedBroadcast');

            if (numberCallInterval) clearInterval(numberCallInterval);

            let callStep = 0;

            numberCallInterval = setInterval(() => {
                if (!globalRoom.gameActive || isFinishingRound) {
                    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    return;
                }

                let calledNum;

                if (callStep < totalPreCalls) {
                    let candidatePreBall = preCallSchedule[callStep];
                    if (
                        candidatePreBall !== null &&
                        (globalRoom.allowRealWinnerThisRound || isSafeNumberForRealUsersInBotMode(candidatePreBall, globalRoom.calledNumbers))
                    ) {
                        calledNum = candidatePreBall;
                    } else {
                        let safeIndex = availableNumbers.findIndex(testNum => {
                            if (globalRoom.allowRealWinnerThisRound) return true;
                            return isSafeNumberForRealUsersInBotMode(testNum, globalRoom.calledNumbers);
                        });

                        if (safeIndex !== -1) {
                            calledNum = availableNumbers.splice(safeIndex, 1)[0];
                        } else if (globalRoom.allowRealWinnerThisRound) {
                            calledNum = availableNumbers.shift();
                        } else {
                            if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                            announceRandomBotAndFinishRound(winningCardNums[0], sharedPattern);
                            return;
                        }
                    }
                    callStep++;

                    if (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                        globalRoom.calledNumbers.push(Number(calledNum));
                        globalRoom.lastCalledNumber = Number(calledNum);

                        io.emit('numberCalled', {
                            number: Number(calledNum),
                            calledNumbers: globalRoom.calledNumbers
                        });
                        io.emit('numberCalledBroadcast', Number(calledNum));
                    }
                    return;
                }

                if (callStep === totalPreCalls) {
                    callStep++;

                    if (
                        !globalRoom.allowRealWinnerThisRound &&
                        finalWinningBall !== undefined &&
                        !isSafeNumberForRealUsersInBotMode(finalWinningBall, globalRoom.calledNumbers)
                    ) {
                        if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        announceRandomBotAndFinishRound(winningCardNums[0], sharedPattern);
                        return;
                    }

                    calledNum = finalWinningBall;

                    if (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                        globalRoom.calledNumbers.push(Number(calledNum));
                        globalRoom.lastCalledNumber = Number(calledNum);

                        io.emit('numberCalled', {
                            number: Number(calledNum),
                            calledNumbers: globalRoom.calledNumbers
                        });
                        io.emit('numberCalledBroadcast', Number(calledNum));
                    }

                    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }

                    winGraceTimeout = setTimeout(() => {
                        if (!globalRoom.gameActive || isFinishingRound) return;

                        let finalWinnersList = winningSocketData.map((item, idx) => {
                            let cNum = winningCardNums[idx];
                            let cList = getCartelaNumbers(cNum);
                            let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers) || sharedPattern;
                            return {
                                username: winningUsernamesArr[idx],
                                socketId: item.socketId,
                                userId: item.userId,
                                isBot: item.isBot,
                                cardNum: cNum,
                                matched: matched
                            };
                        });

                        announceWinnersAndFinish(finalWinnersList);
                    }, 6000);
                }

            }, 5500);
        }
    }, 1000);
}

function endRoundAndRestart() {
    if (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    if (winGraceTimeout) { clearTimeout(winGraceTimeout); winGraceTimeout = null; }
    globalRoom.gameActive = false;
    isFinishingRound = false;
    globalRoom.allowRealWinnerThisRound = false;
    globalRoom.lockedRoundPlayersCount = null;
    globalRoom.lockedRoundPrize = null;
    globalRoom.calledNumbers = [];
    globalRoom.lastCalledNumber = null;

    globalRoom.playerRoundCards = {};
    globalRoom.playerTemporaryCards = {};
    globalRoom.botTakenCards = [];
    globalRoom.takenCards = [];
    globalRoom.emptyCardGraceUntil = Date.now() + EMPTY_CARD_GRACE_MS;

    globalRoom.gameStartTime = Date.now() + 60000;
    globalRoom.forcedWinningCardNums = [];

    io.emit('roundEnded', { nextGameIn: 60000 });
    io.emit('gameEndedBroadcast');
    refreshTakenCardsList();
    updateRoomPlayersAndPot(true);

    setTimeout(() => {
        if (!globalRoom.gameActive && !isFinishingRound) {
            refreshTakenCardsList();
            updateRoomPlayersAndPot(true);
        }
    }, EMPTY_CARD_GRACE_MS + 50);
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
                    await addUserToDbAndSet(senderChatId);

                    if (ADMIN_CHAT_IDS.includes(senderChatId)) {
                        let parts = msgText.split(' ');
                        let cmd = parts[0].toLowerCase();
                        let targetUserId = parts[1] ? String(parts[1]).trim() : null;

                        if (cmd === '/settelebirr' && parts[1]) {
                            let newPhone = parts[1];
                            let newName = parts.slice(2).join(' ') || telebirrConfig.name;

                            telebirrConfig.phone = newPhone;
                            telebirrConfig.name = newName;

                            saveTelebirrConfigToDisk();
                            io.emit('telebirrConfigUpdated', telebirrConfig);

                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                chat_id: senderChatId,
                                text: `✅ የቴሌብር ቁጥር በተሳካ ሁኔታ ተቀይሯል!\n📱 ቁጥር: \`${newPhone}\`\n👤 ስም: *${newName}*`,
                                parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        if ((cmd === '/bonus20' || cmd === '/bonus50') && targetUserId) {
                            let bonusAmount = cmd === '/bonus20' ? 20 : 50;

                            let updatedBal = await setWalletBalance(targetUserId, (userWallets[targetUserId] || 0) + bonusAmount);

                            let targetUserSocketObj = onlineRealUsers.find(u => u.userId === targetUserId);
                            let bonusPayload = {
                                type: 'bonus',
                                amount: bonusAmount,
                                adjustedAmount: bonusAmount,
                                balance: updatedBal
                            };

                            if (targetUserSocketObj) {
                                let targetSocket = io.sockets.sockets.get(targetUserSocketObj.socketId);
                                if (targetSocket) {
                                    targetSocket.emit('financialApproved', bonusPayload);

                                    for (let adminChatId of ADMIN_CHAT_IDS) {
                                        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                            chat_id: adminChatId,
                                            text: `✅ በተሳካ ሁኔታ ለዩዘር ID: \`${targetUserId}\` የ **${bonusAmount} ብር** ቦነስ ተልኳል!`,
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
                    } else {
                        if (msgText.startsWith('/start')) {
                            let startParts = msgText.split(' ');
                            if (startParts.length > 1) {
                                let refId = startParts[1].trim();
                                let newUserId = senderChatId;
                                if (refId && refId !== newUserId && !userReferrers[newUserId]) {
                                    userReferrers[newUserId] = refId;
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

                    if (!reqData) {
                        try {
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                                callback_query_id: callbackQuery.id,
                                text: "⚠️ ይህ ጥያቄ አስቀድሞ በሌላ አድሚን ጸድቋል ወይም ተሰርዟል!",
                                show_alert: true
                            });
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                                chat_id: chatId,
                                message_id: messageId,
                                reply_markup: { inline_keyboard: [] }
                            });
                        } catch (e) {}
                        continue;
                    }

                    let targetSocket = io.sockets.sockets.get(reqData.socketId);
                    let reqType = String(reqData.type || 'deposit').toLowerCase().trim();
                    let rawAmount = Number(reqData.amount) || 0;
                    let finalAmountForClient = (reqType === 'withdraw' || reqType === 'withdrawal') ? -Math.abs(rawAmount) : Math.abs(rawAmount);

                    if (action === 'app') {
                        if (reqType === 'deposit' || reqType === 'bonus') {
                            await setWalletBalance(reqData.userId, (userWallets[reqData.userId] || 0) + Math.abs(rawAmount));

                            let referrerId = userReferrers[reqData.userId];
                            if (referrerId) {
                                let bonusForReferrer = 5;
                                let updatedRefBal = await setWalletBalance(referrerId, (userWallets[referrerId] || 0) + bonusForReferrer);
                                referralEarnings[referrerId] = Number(((referralEarnings[referrerId] || 0) + bonusForReferrer).toFixed(2));

                                let refPayload = {
                                    type: 'bonus',
                                    amount: bonusForReferrer,
                                    adjustedAmount: bonusForReferrer,
                                    balance: updatedRefBal
                                };

                                let refSocketObj = onlineRealUsers.find(u => u.userId === referrerId);
                                if (refSocketObj) {
                                    let refSocket = io.sockets.sockets.get(refSocketObj.socketId);
                                    if (refSocket) {
                                        refSocket.emit('financialApproved', refPayload);
                                        refSocket.emit('chatNotification', { message: `🎁 ዎው! ጓደኛዎ የመጀመሪያውን ዲፖዚት በማድረጉ 5 ብር የሪፈራል ቦነስ አግኝተዋል!` });
                                    }
                                } else {
                                    if (!offlineApprovedQueue[referrerId]) offlineApprovedQueue[referrerId] = [];
                                    offlineApprovedQueue[referrerId].push(refPayload);
                                }

                                for (let adminChatId of ADMIN_CHAT_IDS) {
                                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                        chat_id: adminChatId,
                                        text: `🎁 *ሪፈራል ቦነስ የተሰጠ:* ዩዘር ID \`${referrerId}\` ጓደኛው ዲፖዚት በማድረጉ 5 ብር ተሸልሟል!`,
                                        parse_mode: 'Markdown'
                                    }).catch(() => {});
                                }
                            }
                        }

                        let successPayload = {
                            type: reqData.type,
                            amount: rawAmount,
                            adjustedAmount: finalAmountForClient,
                            balance: userWallets[reqData.userId] || 0
                        };

                        if (targetSocket) {
                            targetSocket.emit('financialApproved', successPayload);
                        } else {
                            if (!offlineApprovedQueue[reqData.userId]) {
                                offlineApprovedQueue[reqData.userId] = [];
                            }
                            offlineApprovedQueue[reqData.userId].push(successPayload);
                        }

                        if (reqData.chatId) {
                            let successMsg = `🎉 *AZ BINGO - የገንዘብ ጥያቄዎ ጸድቋል!*\n\nሰላም *${reqData.username}*፣ የጠየቁት ${rawAmount} ብር ተስተካክሏል። እናመሰግናለን! 🙏`;
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                chat_id: reqData.chatId,
                                text: successMsg,
                                parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        let approvedFinalText = `✅ *ጥያቄው ተረጋግጦ ጸድቋል!* \n👤 ስም: *${reqData.username}*\n🆔 ዩዘር ID: \`${reqData.userId}\`\n💰 መጠን: *${reqData.amount} ብር*\n⏱ የላከበት ሰዓት: _${reqData.requestTimeStr || 'N/A'}_\n🆔 ሪኩዌስት ID: \`${requestId}\`\n✨ *(ሁኔታ: በአድሚን ጸድቆ ተጠናቋል)*`;

                        for (let adminId of ADMIN_CHAT_IDS) {
                            try {
                                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
                                    chat_id: adminId, message_id: messageId,
                                    caption: approvedFinalText, parse_mode: 'Markdown',
                                    reply_markup: { inline_keyboard: [] }
                                });
                            } catch (err) {
                                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                    chat_id: adminId, message_id: messageId,
                                    text: approvedFinalText, parse_mode: 'Markdown',
                                    reply_markup: { inline_keyboard: [] }
                                }).catch(() => {});
                            }
                        }

                    } else {
                        if (reqType === 'withdraw' || reqType === 'withdrawal') {
                            await setWalletBalance(reqData.userId, (userWallets[reqData.userId] || 0) + Math.abs(rawAmount));
                        }

                        if (reqData.chatId) {
                            let rejectMsg = `❌ *AZ BINGO - የገንዘብ ጥያቄዎ ተሰርዟል!*\n\nሰላም *${reqData.username}*፣ የጠየቁት የክፍያ ጥያቄ (${reqData.amount} ብር) በአድሚኑ ተሰርዟል።\n\n⚠️ *ምክንያት:* ያስገቡት ደረሰኝ ወይም መረጃ ልክ አይደለም። እባክዎ ትክክለኛውን ደረሰኝ በማስገባት እንደገና ይሞክሩ። 🙏`;
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                chat_id: reqData.chatId,
                                text: rejectMsg,
                                parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        let finalRejectedBalance = userWallets[reqData.userId] || 0;
                        if (targetSocket) {
                            targetSocket.emit('financialRejected', { type: reqData.type, amount: rawAmount, balance: finalRejectedBalance, status: 'rejected' });
                            targetSocket.emit('updateBalance', { balance: finalRejectedBalance });
                        } else {
                            if (!offlineApprovedQueue[reqData.userId]) offlineApprovedQueue[reqData.userId] = [];
                            offlineApprovedQueue[reqData.userId].push({
                                type: 'balance_update',
                                balance: finalRejectedBalance
                            });
                        }

                        let rejectedFinalText = `❌ *ጥያቄው ተሰርዟል!* \n👤 ስም: *${reqData.username}*\n🆔 ዩዘር ID: \`${reqData.userId}\`\n💰 መጠን: *${reqData.amount} ብር*\n⏱ የላከበት ሰዓት: _${reqData.requestTimeStr || 'N/A'}_\n🆔 ሪኩዌስት ID: \`${requestId}\`\n⚠️ *(ሁኔታ: በአድሚን ተሰርዟል - ብሩ ተመልሷል)*`;

                        for (let adminId of ADMIN_CHAT_IDS) {
                            try {
                                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
                                    chat_id: adminId, message_id: messageId,
                                    caption: rejectedFinalText, parse_mode: 'Markdown',
                                    reply_markup: { inline_keyboard: [] }
                                });
                            } catch (err) {
                                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                    chat_id: adminId, message_id: messageId,
                                    text: rejectedFinalText, parse_mode: 'Markdown',
                                    reply_markup: { inline_keyboard: [] }
                                }).catch(() => {});
                            }
                        }
                    }

                    delete pendingRequests[requestId];

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
    let requestTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

    let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}\n⏱ የላከበት ሰዓት: _${requestTimeStr}_\n🆔 ሪኩዌስት ID: \`${requestId}\``;
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

app.post('/api/financial-request', async (req, bodyRes) => {
    try {
        let { type, amount, username, userId, currentBalance, receiptText, receiptImage } = req.body;

        if (type === 'deposit' && isDepositLocked) {
            return bodyRes.json({ success: false, message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
        }

        let cleanUserId = String(userId || 'unknown');
        await addUserToDbAndSet(cleanUserId);

        let lastRequestTime = userLastRequestTimeMap[cleanUserId] || 0;
        let nowTime = Date.now();
        let cooldownTime = 10 * 60 * 1000;

        if (nowTime - lastRequestTime < cooldownTime) {
            let remainingSecs = Math.ceil((cooldownTime - (nowTime - lastRequestTime)) / 1000);
            let remainingMins = Math.ceil(remainingSecs / 60);
            return bodyRes.json({ success: false, message: `⚠️ እባክዎ ተጨማሪ የክፍያ ጥያቄ ከማስተላለፍዎ በፊት ${remainingMins} ደቂቃ ይጠብቁ!` });
        }

        let existingUserPendingReq = Object.values(pendingRequests).find(r => r.userId === cleanUserId);
        if (existingUserPendingReq) {
            return bodyRes.json({ success: false, message: "⚠️ ገና ያልጸደቀ የክፍያ ጥያቄ አለዎት! እባክዎ አድሚኑ እስኪቀበለው ይጠብቁ።" });
        }

        let parsedAmount = Number(amount) || 0;
        let currentWalletBal = userWallets[cleanUserId] || 0;

        if (type === 'withdraw' || type === 'withdrawal') {
            if (currentWalletBal < parsedAmount) {
                return bodyRes.json({ success: false, message: "⚠️ በቂ ቀሪ ሂሳብ የለዎትም!" });
            }
            await setWalletBalance(cleanUserId, currentWalletBal - parsedAmount);
        }

        userLastRequestTimeMap[cleanUserId] = nowTime;

        let requestId = 'req_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        let requestTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

        pendingRequests[requestId] = {
            userId: cleanUserId,
            chatId: userId,
            type,
            amount: parsedAmount,
            username,
            socketId: null,
            timestamp: Date.now(),
            requestTimeStr: requestTimeStr,
            status: 'pending'
        };

        let caption = `🔔 *AZ BINGO - 💳 ቴሌብር ዲፖዚት*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${userWallets[cleanUserId]} ብር*\n📥 የጠየቀው: *${parsedAmount} ብር*\n⏱ የላከበት ሰዓት: _${requestTimeStr}_\n🆔 ሪኩዌስት ID: \`${requestId}\``;

        if (receiptText) {
            caption += `\n\n📄 *የደረሰኝ ጽሑፍ (SMS):*\n\`${receiptText}\``;
        }

        for (let adminChatId of ADMIN_CHAT_IDS) {
            try {
                if (receiptImage && receiptImage.startsWith('data:image')) {
                    let base64Data = receiptImage.replace(/^data:image\/\w+;base64,/, "");
                    let buffer = Buffer.from(base64Data, 'base64');

                    let formDataTelegram = new (require('form-data'))();
                    formDataTelegram.append('chat_id', adminChatId);
                    formDataTelegram.append('photo', buffer, { filename: 'receipt.jpg' });
                    formDataTelegram.append('caption', caption);
                    formDataTelegram.append('parse_mode', 'Markdown');
                    formDataTelegram.append('reply_markup', JSON.stringify({
                        inline_keyboard: [
                            [
                                { text: "✅ አጽድቅ", callback_data: "app_" + requestId },
                                { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }
                            ]
                        ]
                    }));

                    axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formDataTelegram, {
                        headers: formDataTelegram.getHeaders()
                    }).catch(() => {});
                } else {
                    axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: adminChatId,
                        text: caption,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "✅ አጽድቅ", callback_data: "app_" + requestId },
                                    { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }
                                ]
                            ]
                        }
                    }).catch(() => {});
                }
            } catch (e) {}
        }

        bodyRes.json({
            success: true,
            message: "✅ ጥያቄዎ ለአድሚን ተልኳል!",
            newBalance: userWallets[cleanUserId],
            request: {
                id: requestId,
                type: type,
                amount: parsedAmount,
                status: 'pending',
                time: requestTimeStr
            }
        });
    } catch (err) {
        bodyRes.status(500).json({ success: false, message: err.message });
    }
});

io.on('connection', (socket) => {
    connectedRealPlayers.push(socket.id);
    if (!globalRoom.gameActive) {
        updateRoomPlayersAndPot(true);
    }

    socket.emit('syncGameState', {
        ...globalRoom,
        playersCount: globalRoom.gameActive && globalRoom.lockedRoundPlayersCount !== null
            ? globalRoom.lockedRoundPlayersCount
            : globalRoom.playersCount,
        prize: globalRoom.gameActive && globalRoom.lockedRoundPrize !== null
            ? globalRoom.lockedRoundPrize
            : Math.floor((globalRoom.playersCount * 10) * 0.90)
    });
    refreshTakenCardsList();

    socket.emit('financialLockStatus', { isDepositLocked, isWithdrawLocked });
    socket.emit('telebirrConfigUpdated', telebirrConfig);
    socket.emit('botConfigUpdated', botConfig);

    socket.on('registerRealUser', async (userData) => {
        if (userData && userData.userId) {
            let userId = String(userData.userId);

            await addUserToDbAndSet(userId);
            await loadWalletsFromDb();
            await loadClaimedWelcomeBonusUsersFromDb();

            let clientBalance = userData.balance !== undefined ? parseFloat(userData.balance) : 0;
            if (isNaN(clientBalance) || clientBalance < 0) clientBalance = 0;

            if (userWallets[userId] === undefined) {
                await setWalletBalance(userId, clientBalance);
            }

            if (!globalRoom.gameActive) {
                Object.keys(globalRoom.playerRoundCards).forEach(sId => {
                    if (globalRoom.playerRoundCards[sId].userId === userId) {
                        delete globalRoom.playerRoundCards[sId];
                    }
                });
            }

            delete globalRoom.playerTemporaryCards[socket.id];

            onlineRealUsers = onlineRealUsers.filter(u => u.userId !== userId);
            onlineRealUsers.push({ socketId: socket.id, userId: userId, username: userData.username || 'No Username', fullName: userData.fullName || 'ተጫዋች' });

            if (!claimedWelcomeBonusUsers.has(userId) && userWallets[userId] === 0) {
                await markWelcomeBonusClaimed(userId);
                let updatedWelcomeBal = await setWalletBalance(userId, (userWallets[userId] || 0) + 20);
                socket.emit('welcomeBonusGranted', {
                    amount: 20,
                    balance: updatedWelcomeBal,
                    message: "እንኳን ደህና መጡ! የመጀመሪያ የአንድ ጊዜ የ20 ብር ቦነስ ተሰጥቷል!"
                });
            } else {
                await markWelcomeBonusClaimed(userId);
            }

            if (offlineApprovedQueue[userId] && offlineApprovedQueue[userId].length > 0) {
                offlineApprovedQueue[userId].forEach(item => {
                    socket.emit('financialApproved', item);
                });
                delete offlineApprovedQueue[userId];
            }

            let botUsername = "AzBIng2obot";
            let myReferralLink = `https://t.me/${botUsername}?start=${userId}`;
            let myTotalEarnings = referralEarnings[userId] || 0;

            socket.emit('updateBalance', { balance: userWallets[userId] });
            socket.emit('referralData', { referralLink: myReferralLink, totalEarnings: myTotalEarnings });

            refreshTakenCardsList();
            if (!globalRoom.gameActive) {
                updateRoomPlayersAndPot(true);
            }
            socket.emit('syncGameState', {
                ...globalRoom,
                playersCount: globalRoom.gameActive && globalRoom.lockedRoundPlayersCount !== null
                    ? globalRoom.lockedRoundPlayersCount
                    : globalRoom.playersCount,
                prize: globalRoom.gameActive && globalRoom.lockedRoundPrize !== null
                    ? globalRoom.lockedRoundPrize
                    : Math.floor((globalRoom.playersCount * 10) * 0.90)
            });
        }
    });

    socket.on('playerClaimBingo', (data) => {
        if (!globalRoom.gameActive || isFinishingRound) return;

        if (!enableOnlyRealUsersMode && !globalRoom.allowRealWinnerThisRound) {
            socket.emit('cardSelectionError', "⚠️ በዚህ ዙር የእርስዎ ካርድ አሸናፊ አልሆነም!");
            return;
        }

        let userId = String(data.userId);
        let cardNum = Number(data.cardNum);
        let playerRoundEntry = globalRoom.playerRoundCards[socket.id];
        let ownsCardInRound = Boolean(
            playerRoundEntry &&
            Array.isArray(playerRoundEntry.cards) &&
            playerRoundEntry.cards.map(Number).includes(cardNum)
        );

        if (!ownsCardInRound) {
            socket.emit('cardSelectionError', "⚠️ ይህ ካርድ በአሁኑ ዙር በእርስዎ ስም አልተመዘገበም!");
            return;
        }

        let cList = getCartelaNumbers(cardNum);
        let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers);

        if (matched) {
            announceWinnersAndFinish([{
                username: data.username || 'ተጫዋች',
                socketId: socket.id,
                userId: userId,
                isBot: false,
                cardNum: cardNum,
                matched: matched
            }]);
        } else {
            socket.emit('cardSelectionError', "⚠️ ማሳሰቢያ፡ የእርስዎ ካርድ ገና ሙሉ ማሸነፊያ (Pattern) አላሟላም!");
        }
    });

    socket.on('getAdminRealUsers', () => {
        socket.emit('adminRealUsersListUpdate', onlineRealUsers);
    });

    socket.on('adminCheckUserBalance', async (data) => {
        if (data && data.targetUserId) {
            let tId = String(data.targetUserId).trim();
            await loadWalletsFromDb();
            let foundBalance = 0.00;
            if (userWallets[tId] !== undefined) {
                foundBalance = parseFloat(userWallets[tId]);
            } else {
                let matchedKey = Object.keys(userWallets).find(k => String(k).trim() === tId);
                if (matchedKey) {
                    foundBalance = parseFloat(userWallets[matchedKey]);
                }
            }

            socket.emit('adminUserBalanceResponse', {
                success: true,
                targetUserId: tId,
                balance: foundBalance,
                message: `👤 ዩዘር ID (${tId}) ቀሪ ሂሳብ: ${foundBalance} ብር`
            });
        }
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

    socket.on('adminUpdateTelebirr', (data) => {
        if (data && data.phone) {
            telebirrConfig.phone = data.phone;
            if (data.name) telebirrConfig.name = data.name;

            saveTelebirrConfigToDisk();
            io.emit('telebirrConfigUpdated', telebirrConfig);
            socket.emit('adminTelebirrResponse', { success: true, message: `✅ የቴሌብር ቁጥር ተቀይሯል!` });
        }
    });

    socket.on('adminUpdateBotConfig', (data) => {
        if (data && data.minBots !== undefined && data.maxBots !== undefined) {
            let minB = parseInt(data.minBots);
            let maxB = parseInt(data.maxBots);

            if (!isNaN(minB) && !isNaN(maxB)) {
                if (minB < 1) minB = 1;
                if (maxB < minB) maxB = minB;

                botConfig.minBots = minB;
                botConfig.maxBots = maxB;

                saveBotConfigToDisk();
                io.emit('botConfigUpdated', botConfig);
                if (!globalRoom.gameActive) {
                    updateRoomPlayersAndPot(true);
                }

                socket.emit('adminBotResponse', { success: true, message: `✅ የቦቶች ብዛት (Min: ${minB}, Max: ${maxB}) ተስተካክሏል!` });
            } else {
                socket.emit('adminBotResponse', { success: false, message: `⚠️ እባክዎ ትክክለኛ ቁጥሮችን ያስገቡ!` });
            }
        }
    });

    socket.on('adminSendBonus', async (data) => {
        if (socket.id) {
            let targetUserId = String(data.targetUserId).trim();
            let bonusAmount = Number(data.amount) || 20;

            let updatedBal = await setWalletBalance(targetUserId, (userWallets[targetUserId] || 0) + bonusAmount);

            let bonusPayload = {
                type: 'bonus',
                amount: bonusAmount,
                adjustedAmount: bonusAmount,
                balance: updatedBal
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
        let messageText = data && data.message ? String(data.message).trim() : null;

        if (!messageText) {
            socket.emit('adminBroadcastResponse', { success: false, message: "⚠️ እባክዎ የሚላከውን መልእክት ይጻፉ!" });
            return;
        }

        if (MONGODB_URI && mongoose.connection.readyState === 1) {
            try {
                const dbUsers = await RegisteredUser.find({}, { userId: 1, _id: 0 }).lean();
                dbUsers.forEach(u => {
                    if (u.userId) allRegisteredUsers.add(String(u.userId));
                });
            } catch (e) {}
        }

        const allKnownIds = new Set([
            ...allRegisteredUsers,
            ...Object.keys(userWallets || {}),
            ...claimedWelcomeBonusUsers,
            ...Object.keys(userReferrers || {}),
            ...Object.values(userReferrers || {})
        ]);

        const allUserIds = [...allKnownIds].filter(id => /^\d+$/.test(String(id).trim()));

        (async () => {
            for (let uId of allUserIds) {
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: uId,
                        text: `📢 AZ BINGO - ማስታወቂያ\n\n${messageText}`
                    });
                    await new Promise(resolve => setTimeout(resolve, 150));
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

    socket.on('confirmCards', async (data) => {
        if (data && data.cards && Array.isArray(data.cards)) {
            let userId = String(data.userId || 'unknown');
            await addUserToDbAndSet(userId);
            let cleanCards = data.cards.map(Number).filter(n => n >= 1 && n <= 500);

            if (cleanCards.length === 0 || cleanCards.length > 2) {
                socket.emit('cardSelectionError', "⚠️ ከ 1 እስከ 2 ካርድ ብቻ መምረጥ ይችላሉ!");
                return;
            }

            if (globalRoom.gameActive) {
                socket.emit('cardSelectionError', "⚠️ ጨዋታው ተጀምሯል! በቀጣዩ ዙር ይሞክሩ።");
                return;
            }

            if (userWallets[userId] === undefined) {
                let initBal = (data.balance !== undefined && !isNaN(data.balance)) ? parseFloat(data.balance) : 0;
                await setWalletBalance(userId, Math.max(0, initBal));
            }

            let prevCards = (globalRoom.playerRoundCards[socket.id] && Array.isArray(globalRoom.playerRoundCards[socket.id].cards))
                ? globalRoom.playerRoundCards[socket.id].cards
                : [];
            let prevCost = prevCards.length * 10;
            let newCost = cleanCards.length * 10;
            let diffCost = newCost - prevCost;

            let currentBal = parseFloat(userWallets[userId] || 0);
            if (diffCost > 0 && currentBal < diffCost) {
                socket.emit('cardSelectionError', "⚠️ በቂ ሂሳብ የለዎትም!");
                socket.emit('updateBalance', { balance: currentBal });
                return;
            }

            let nextBal = await setWalletBalance(userId, Math.max(0, currentBal - diffCost));

            globalRoom.playerRoundCards[socket.id] = {
                cards: cleanCards,
                username: data.username || 'ተጫዋች',
                userId: userId
            };
            if (globalRoom.playerTemporaryCards[socket.id]) {
                delete globalRoom.playerTemporaryCards[socket.id];
            }

            refreshTakenCardsList();
            if (!globalRoom.gameActive) {
                updateRoomPlayersAndPot(true);
            }

            socket.emit('cardSelectionSuccess', { balance: nextBal });
            socket.emit('updateBalance', { balance: nextBal });
        }
    });

    socket.on('adminSetNextWinner', (data) => {
        let winnerType = data.winnerType ? String(data.winnerType).trim() : null;

        if (winnerType === 'only_real_users_mode') {
            enableOnlyRealUsersMode = true;
            forcedNextWinner = 'random_real';
            if (!globalRoom.gameActive) updateRoomPlayersAndPot(true);
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [ሪል ዩዘሮች ብቻ - True Random] ተቀይሯል!` });
        } else if (winnerType === 'standard_bot_mode') {
            enableOnlyRealUsersMode = false;
            forcedNextWinner = null;
            if (!globalRoom.gameActive) updateRoomPlayersAndPot(true);
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [መደበኛ (ቦቶች + ሪል)] ተመለሰ!` });
        } else {
            forcedNextWinner = winnerType;
            socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
        }
    });

    socket.on('financialRequest', async (data) => {
        data.type = data.type || 'deposit';
        let { type, amount, username, userId, currentBalance, phone, receipt, telegramChatId } = data;

        if ((type === 'withdraw' || type === 'withdrawal') && isWithdrawLocked) {
            socket.emit('financialError', { message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
            return;
        }

        let cleanUserId = String(userId || 'unknown');
        await addUserToDbAndSet(cleanUserId);

        let lastRequestTime = userLastRequestTimeMap[cleanUserId] || 0;
        let nowTime = Date.now();
        let cooldownTime = 10 * 60 * 1000;

        if (nowTime - lastRequestTime < cooldownTime) {
            let remainingSecs = Math.ceil((cooldownTime - (nowTime - lastRequestTime)) / 1000);
            let remainingMins = Math.ceil(remainingSecs / 60);
            socket.emit('financialError', { message: `⚠️ እባክዎ ተጨማሪ የክፍያ ጥያቄ ከማስተላለፍዎ በፊት ${remainingMins} ደቂቃ ይጠብቁ!` });
            return;
        }

        let existingUserPendingReq = Object.values(pendingRequests).find(r => r.userId === cleanUserId);
        if (existingUserPendingReq) {
            socket.emit('financialError', { message: "⚠️ ገና ያልጸደቀ የክፍያ ጥያቄ አለዎት! እባክዎ አድሚኑ እስኪቀበለው ይጠብቁ።" });
            return;
        }

        userLastRequestTimeMap[cleanUserId] = nowTime;

        let parsedAmount = Number(amount) || 0;
        let currentWalletBal = userWallets[cleanUserId] || 0;

        if (type === 'withdraw' || type === 'withdrawal') {
            if (currentWalletBal < parsedAmount) {
                socket.emit('financialError', { message: "⚠️ በቂ ቀሪ ሂሳብ የለዎትም!" });
                return;
            }
            let updatedWithdrawBal = await setWalletBalance(cleanUserId, currentWalletBal - parsedAmount);
            socket.emit('updateBalance', { balance: updatedWithdrawBal });
        }

        let requestId = 'req_' + socket.id.substring(0, 5) + '_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        let requestTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

        pendingRequests[requestId] = {
            userId: cleanUserId,
            chatId: telegramChatId || cleanUserId,
            type,
            amount: parsedAmount,
            username,
            socketId: socket.id,
            timestamp: Date.now(),
            requestTimeStr: requestTimeStr,
            status: 'pending'
        };

        sendAdminFinancialRequest(requestId, type, parsedAmount, username, cleanUserId, userWallets[cleanUserId], phone, receipt);
        socket.emit('requestSubmitted', {
            success: true,
            message: "✅ ጥያቄዎ ለአድሚን ተልኳል!",
            balance: userWallets[cleanUserId],
            request: {
                id: requestId,
                type: type,
                amount: parsedAmount,
                status: 'pending',
                time: requestTimeStr
            }
        });
    });

    socket.on('disconnect', () => {
        connectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        onlineRealUsers = onlineRealUsers.filter(u => u.socketId !== socket.id);

        if (!globalRoom.gameActive) {
            delete globalRoom.playerRoundCards[socket.id];
        }
        delete globalRoom.playerTemporaryCards[socket.id];

        refreshTakenCardsList();
        if (!globalRoom.gameActive) {
            updateRoomPlayersAndPot(true);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("AZ Server running on port " + PORT);
});
