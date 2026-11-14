Const express = require('express');
Const http = require('http');
Const { Server } = require('socket.io');
Const path = require('path');
Const axios = require('axios');
Const fs = require('fs');

Const app = express();
Const server = http.createServer(app);
Const io = new Server(server, {
  MaxHttpBufferSize: 1e8 
});

App.express = express;
App.use(express.json({ limit: '50mb' }));
App.use(express.urlencoded({ limit: '50mb', extended: true }));

App.get('/', (req, res) => {
    Res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

App.use(express.static(path.join(__dirname, 'public')));

Const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8816726564:AAG3ETwx98oBfjDV8I-BipzEXGZCnJPFezg";
Const ADMIN_CHAT_IDS = ["371093083", "8648229637"];

Const claimedWelcomeBonusUsers = new Set();
Const userWallets = {}; 
Const allRegisteredUsers = new Set();

Let isDepositLocked = false;
Let isWithdrawLocked = false;

Const configFilePath = path.join(__dirname, 'telebirr_config.json');
Let telebirrConfig = {
    Phone: "0900015260",
    Name: "ABEYE"
};

If (fs.existsSync(configFilePath)) {
    Try {
        Let savedConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        If (savedConfig.phone) telebirrConfig.phone = savedConfig.phone;
        If (savedConfig.name) telebirrConfig.name = savedConfig.name;
    } catch (e) {}
}

Function saveTelebirrConfigToDisk() {
    Try {
        Fs.writeFileSync(configFilePath, JSON.stringify(telebirrConfig, null, 2));
    } catch (e) {}
}

Const botConfigFilePath = path.join(__dirname, 'bot_config.json');
Let botConfig = {
    MinBots: 40,
    MaxBots: 250
};

If (fs.existsSync(botConfigFilePath)) {
    Try {
        Let savedBotConfig = JSON.parse(fs.readFileSync(botConfigFilePath, 'utf8'));
        If (savedBotConfig.minBots !== undefined) botConfig.minBots = Number(savedBotConfig.minBots);
        If (savedBotConfig.maxBots !== undefined) botConfig.maxBots = Number(savedBotConfig.maxBots);
    } catch (e) {}
}

Function saveBotConfigToDisk() {
    Try {
        Fs.writeFileSync(botConfigFilePath, JSON.stringify(botConfig, null, 2));
    } catch (e) {}
}

Const baseNumberFlowSequence = [
    12, 19, 22, 23, 32, 18, 19, 12, 27, 27, 23, 17, 19, 19, 22, 19, 24, 23, 19, 18, 
    16, 14, 22, 26, 30, 32, 17, 18, 18, 18, 22, 27, 32, 27, 19, 18, 21, 20, 26, 25, 
    19, 18, 23, 26, 19, 19, 13, 15, 12, 24, 19, 12, 16, 33, 11, 22, 18, 16, 22, 32, 
    32, 14, 19, 18, 13, 17, 18, 12, 30, 21, 19, 18, 28, 26, 24, 19, 13, 17, 17, 30, 
    18, 19
];
Let sequenceIndex = 0;

Const ETHIOPIAN_BOT_NAMES = [
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
    "Falcon", "Dawit_B", "Ermias_99", "Solomon", "Bethel_M",
    "Miki_Bingo", "Hanna", "Natnael", "Kidist", "Bereket",
    "Samson_tefera", "Yordanos", "Feven_A", "Henok_Z", "Meron",
    "Rediet", "Abel_T", "Tsion", "Brook", "Lidya",
    "Michael_B", "Nahom", "Rut_K", "Robel", "Tigist",
    "Biniyam", "Kalkidan", "Ephrem", "Rahel", "Yonas", "Semhar"
];

Function getRandomBotNames(count) {
    Let shuffled = [...ETHIOPIAN_BOT_NAMES].sort(() => 0.5 - Math.random());
    Return shuffled.slice(0, count);
}

Let globalRoom = {
    GameActive: false,
    CalledNumbers: [],
    GameStartTime: Date.now() + 60000,
    PlayersCount: 140,
    TakenCards: [],
    PlayerRoundCards: {}, 
    PlayerTemporaryCards: {},
    LastCalledNumber: null,
    TargetWinCallCount: 12,
    ForcedWinningCardNums: []
};

Let forcedNextWinner = null; 
Let enableOnlyRealUsersMode = false; 
Let onlineRealUsers = [];
Let pendingRequests = {};
Let offlineApprovedQueue = {}; 
Let gameInterval = null;
Let numberCallInterval = null;
Let winGraceTimeout = null;
Let connectedRealPlayers = [];

Function getCartelaNumbers(cardNum) {
    Let cardNumbersByCol = { B: [], I: [], N: [], G: [], O: [] };
    Let colRanges = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
    Let cols = ['B', 'I', 'N', 'G', 'O'];

    Cols.forEach((col, colIdx) => {
        Let range = colRanges[col];
        Let pool = [];
        For (let n = range[0]; n <= range[1]; n++) pool.push(n);

        Let seed = (cardNum * 7919) + (colIdx * 104729);
        For (let i = pool.length - 1; i > 0; i--) {
            Seed = (seed * 9301 + 49297) % 233280;
            Let rnd = seed / 233280;
            Let j = Math.floor(rnd * (i + 1));
            Let temp = pool[i]; pool[i] = pool[j]; pool[j] = temp;
        }
        CardNumbersByCol[col] = pool.slice(0, 5);
    });

    Let flatList = [];
    For (let r = 0; r < 5; r++) {
        Cols.forEach(col => {
            If (r === 2 && col === 'N') flatList.push("FREE");
            Else flatList.push(cardNumbersByCol[col][r]);
        });
    }
    Return flatList;
}

Function getWinningMatchedIndices(winningCardNumbers, calledNumbers) {
    If (!calledNumbers || calledNumbers.length === 0) return null;

    Let grid2D = [];
    Let cleanCalled = calledNumbers.map(n => Number(n));
    
    For(let r=0; r<5; r++) {
        Let row = [];
        For(let c=0; c<5; c++) {
            Let idx = r * 5 + c;
            Let val = winningCardNumbers[idx];
            Let isHit = (val === "FREE" || cleanCalled.includes(Number(val)));
            Row.push({ idx, isHit, val });
        }
        Grid2D.push(row);
    }

    For(let r=0; r<5; r++) {
        If(grid2D[r].every(cell => cell.isHit)) {
            Return grid2D[r].map(cell => cell.idx);
        }
    }

    For(let c=0; c<5; c++) {
        Let colHits = true;
        Let colCells = [];
        For(let r=0; r<5; r++) {
            ColCells.push(grid2D[r][c]);
            If(!grid2D[r][c].isHit) colHits = false;
        }
        If(colHits) {
            Return colCells.map(cell => cell.idx);
        }
    }

    Let diag1Hits = true, diag2Hits = true;
    Let diag1Cells = [], diag2Cells = [];
    For(let i=0; i<5; i++) {
        Diag1Cells.push(grid2D[i][i]);
        Diag2Cells.push(grid2D[i][4-i]);
        If(!grid2D[i][i].isHit) diag1Hits = false;
        If(!grid2D[i][4-i].isHit) diag2Hits = false;
    }
    If(diag1Hits) return diag1Cells.map(cell => cell.idx);
    If(diag2Hits) return diag2Cells.map(cell => cell.idx);

    If(grid2D[0][0].isHit && grid2D[0][4].isHit && grid2D[4][0].isHit && grid2D[4][4].isHit) {
        Return [0, 4, 20, 24];
    }

    Return null;
}

Let lastSmoothCount = 95; 

Function getRealisticBotsCount(realCount, isGameActive = false) {
    If (enableOnlyRealUsersMode) return 0;

    Let minB = Number(botConfig.minBots) || 40;
    Let maxB = Number(botConfig.maxBots) || 250;
    If (minB > maxB) { let tmp = minB; minB = maxB; maxB = tmp; }

    Const now = new Date();
    Let utcHours = now.getUTCHours();
    Let ethiopianHour = (utcHours + 3) % 24; 
    Let targetBase = Math.floor((minB + maxB) / 2);

    If (ethiopianHour >= 6 && ethiopianHour < 12) {
        TargetBase = minB + Math.floor(Math.random() * Math.max(1, (maxB - minB) * 0.3)); 
    } else if (ethiopianHour >= 12 && ethiopianHour < 19) {
        Let progress = (ethiopianHour - 12) / 7; 
        TargetBase = Math.floor(minB + (progress * (maxB - minB) * 0.6)); 
    } else if (ethiopianHour >= 19 || ethiopianHour < 3) {
        TargetBase = Math.floor(minB + ((maxB - minB) * 0.7) + Math.random() * Math.max(1, (maxB - minB) * 0.3)); 
    } else {
        TargetBase = minB + Math.floor(Math.random() * Math.max(1, (maxB - minB) * 0.4)); 
    }

    If (isGameActive) {
        LastSmoothCount = targetBase;
    } else {
        Let step = Math.floor(Math.random() * 5) + 1; 
        If (lastSmoothCount < targetBase) {
            LastSmoothCount += step;
            If (lastSmoothCount > targetBase) lastSmoothCount = targetBase;
        } else if (lastSmoothCount > targetBase) {
            LastSmoothCount -= step;
            If (lastSmoothCount < targetBase) lastSmoothCount = targetBase;
        } else {
            Let minorDelta = (Math.floor(Math.random() * 3) + 1) * (Math.random() < 0.5 ? 1 : -1);
            LastSmoothCount += minorDelta;
        }
    }

    If (lastSmoothCount < minB) lastSmoothCount = minB;
    If (lastSmoothCount > maxB) lastSmoothCount = maxB;

    Return lastSmoothCount;
}

Function updateRoomPlayersAndPot() {
    Let realCount = connectedRealPlayers.length;
    Let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([sId, data]) => data.cards && data.cards.length > 0);
    
    If (enableOnlyRealUsersMode) {
        Let uniqueRealCardsCount = 0;
        ActiveRealEntries.forEach(([sId, data]) => {
            If (data.cards) uniqueRealCardsCount += data.cards.length;
        });
        GlobalRoom.playersCount = uniqueRealCardsCount > 0 ? uniqueRealCardsCount : activeRealEntries.length;
        If (globalRoom.playersCount === 0) globalRoom.playersCount = realCount > 0 ? realCount : 1;
    } else {
        Let currentBotsCount = getRealisticBotsCount(realCount, globalRoom.gameActive);
        GlobalRoom.playersCount = currentBotsCount + realCount; 
    }
    Io.emit('updatePlayersCount', globalRoom.playersCount);
}

SetInterval(() => {
    If (!globalRoom.gameActive) {
        UpdateRoomPlayersAndPot();
    }
}, 4000);

Function refreshTakenCardsList() {
    Let allTaken = [];
    Object.values(globalRoom.playerRoundCards).forEach(p => {
        If (p.cards) allTaken.push(...p.cards);
    });
    Object.values(globalRoom.playerTemporaryCards).forEach(cards => {
        If (cards) allTaken.push(...cards);
    });
    GlobalRoom.takenCards = Array.from(new Set(allTaken));
    Io.emit('updateTakenCards', globalRoom.takenCards);
}

Function simulateBotCardSelections() {
    If (globalRoom.gameActive || enableOnlyRealUsersMode) return;
    Let available = [];
    For(let i = 1; i <= 500; i++) {
        If(!globalRoom.takenCards.includes(i)) available.push(i);
    }
    Let botPicksCount = Math.floor(Math.random() * 15) + 10;
    For(let i = 0; i < botPicksCount && available.length > 0; i++) {
        Let randIdx = Math.floor(Math.random() * available.length);
        Let cardToTake = available.splice(randIdx, 1)[0];
        If(!globalRoom.takenCards.includes(cardToTake)) {
            GlobalRoom.takenCards.push(cardToTake);
        }
    }
    Io.emit('updateTakenCards', globalRoom.takenCards);
}

SetInterval(simulateBotCardSelections, 6000);

Async function sendWinnerNotificationToAdmin(winnerNamesStr, cardNum, prizePerWinner, isRealUser) {
    If (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_IDS.length || !isRealUser) return;
    Let message = `🏆 *AZ BINGO - 👤 አሸናፊ(ዎች)*\n\n🎉 አሸናፊዎች: *${winnerNamesStr}*\n🔢 ዋና ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው የድርሻ ብር (ለእያንዳንዱ): *${prizePerWinner} ብር*\n👥 ተጫዋቾች ብዛት: ${globalRoom.playersCount}`;
    
    For (let adminChatId of ADMIN_CHAT_IDS) {
        Try {
            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                Chat_id: adminChatId, text: message, parse_mode: 'Markdown'
            });
        } catch (error) {}
    }
}

Function announceWinnersAndFinish(winnersDataList) {
    If (!globalRoom.gameActive) return;
    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    If (winGraceTimeout) { clearTimeout(winGraceTimeout); winGraceTimeout = null; }

    Let primaryWinner = winnersDataList[0];
    Let primaryCardNum = primaryWinner.cardNum;
    Let matchedIndices = primaryWinner.matched;
    Let winnerNamesStr = winnersDataList.map(w => w.username).join(', ');
    Let winnersCount = winnersDataList.length;

    Let totalPot = (globalRoom.playersCount || 1) * 10;
    Let prizePerWinner = Math.floor(((totalPot * 0.90) / winnersCount));
    Let hasRealWinner = winnersDataList.some(w => !w.isBot);

    WinnersDataList.forEach(w => {
        If (!w.isBot && w.userId) {
            UserWallets[w.userId] = (userWallets[w.userId] || 0) + prizePerWinner;
        }
    });

    SendWinnerNotificationToAdmin(winnerNamesStr, primaryCardNum, prizePerWinner, hasRealWinner);

    WinnersDataList.forEach(w => {
        If (!w.isBot && w.socketId) {
            Let targetSocket = io.sockets.sockets.get(w.socketId);
            If (targetSocket) {
                TargetSocket.emit('rewardPrize', { prize: prizePerWinner, balance: userWallets[w.userId] });
            }
        }
    });

    Io.emit('bingoWinner', {
        Username: winnerNamesStr,
        UserId: winnersDataList.find(w => !w.isBot)?.socketId || null,
        CardNum: primaryCardNum,
        Prize: prizePerWinner,
        CalledNumbers: globalRoom.calledNumbers,
        MatchedIndices: matchedIndices,
        WinnersCount: winnersCount,
        PlayersCount: globalRoom.playersCount
    });

    SetTimeout(() => { endRoundAndRestart(); }, 6000);
}

Function startMainGameLoop() {
    If (gameInterval) clearInterval(gameInterval);
    GlobalRoom.gameStartTime = Date.now() + 60000;

    GameInterval = setInterval(() => {
        Let timeLeft = globalRoom.gameStartTime - Date.now();

        If (timeLeft <= 0 && !globalRoom.gameActive) {
            GlobalRoom.gameActive = true;
            GlobalRoom.calledNumbers = []; 
            GlobalRoom.lastCalledNumber = null;
            
            UpdateRoomPlayersAndPot();

            Let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
            Let currentWinnerType = forcedNextWinner;
            ForcedNextWinner = null; 

            If (enableOnlyRealUsersMode) {
                Let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
                AvailableNumbers.sort(() => 0.5 - Math.random());

                Io.emit('gameStarted', { calledNumbers: [] });
                Io.emit('gameStartedBroadcast');

                If (numberCallInterval) clearInterval(numberCallInterval);

                NumberCallInterval = setInterval(() => {
                    If (!globalRoom.gameActive) {
                        If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        Return;
                    }

                    If (availableNumbers.length === 0 || globalRoom.calledNumbers.length >= 75) {
                        If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        SetTimeout(() => { endRoundAndRestart(); }, 3000);
                        Return;
                    }

                    Let calledNum = availableNumbers.shift();
                    GlobalRoom.calledNumbers.push(Number(calledNum));
                    GlobalRoom.lastCalledNumber = Number(calledNum);

                    Io.emit('numberCalled', {
                        Number: Number(calledNum),
                        CalledNumbers: globalRoom.calledNumbers
                    });
                    Io.emit('numberCalledBroadcast', Number(calledNum));

                    Let winningWinnersList = [];
                    Object.entries(globalRoom.playerRoundCards).forEach(([socketId, pData]) => {
                        If (pData && pData.cards) {
                            PData.cards.forEach(cNum => {
                                Let cList = getCartelaNumbers(cNum);
                                Let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers);
                                If (matched) { 
                                    WinningWinnersList.push({
                                        Username: pData.username || 'ተጫዋች',
                                        SocketId: socketId,
                                        UserId: pData.userId,
                                        IsBot: false,
                                        CardNum: cNum,
                                        Matched: matched
                                    });
                                }
                            });
                        }
                    });

                    If (winningWinnersList.length > 0) {
                        If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                        WinGraceTimeout = setTimeout(() => {
                            AnnounceWinnersAndFinish(winningWinnersList);
                        }, 6000);
                    }

                }, 4500);

                Return;
            }

            // --- Standard Bot + Real Users Mode ---
            Let winningUsernamesArr = [];
            Let winningSocketData = []; 
            Let winnersCount = Math.random() < 0.75 ? 1 : 2; 
            Let winningCardNums = [];

            Let targetRealCount = 0;
            Let explicitRealForced = (currentWinnerType === 'only_real_users' || currentWinnerType === 'random_real' || currentWinnerType === 'random_3_real' || currentWinnerType === 'multi_real_3' || currentWinnerType === 'real_user' || currentWinnerType === 'single_real');

            If (explicitRealForced && activeRealEntries.length > 0) {
                If ((currentWinnerType && (currentWinnerType.includes('3') || currentWinnerType === 'multi_real_3' || currentWinnerType === 'random_3_real')) && activeRealEntries.length >= 3) {
                    TargetRealCount = 3;
                    WinnersCount = 3; 
                } else {
                    TargetRealCount = 1;
                    WinnersCount = 1; 
                }
            }

            If (targetRealCount > 0 && activeRealEntries.length > 0) {
                Let shuffledReal = [...activeRealEntries].sort(() => 0.5 - Math.random());
                Let chosenReal = shuffledReal.slice(0, targetRealCount);
                ChosenReal.forEach(item => {
                    WinningUsernamesArr.push(item[1].username);
                    WinningSocketData.push({ socketId: item[0], userId: item[1].userId, isBot: false });
                    WinningCardNums.push(item[1].cards && item[1].cards.length > 0 ? item[1].cards[0] : Math.floor(Math.random() * 450) + 1);
                });
            }

            While (winningUsernamesArr.length < winnersCount) {
                Let bName = getRandomBotNames(1)[0];
                WinningUsernamesArr.push(bName);
                WinningSocketData.push({ socketId: null, userId: null, isBot: true });
                WinningCardNums.push(Math.floor(Math.random() * 450) + 1);
            }

            WinnersCount = winningUsernamesArr.length > 0 ? winningUsernamesArr.length : 1;
            GlobalRoom.forcedWinningCardNums = winningCardNums;
            
            Let targetCallCount = Math.max(6, baseNumberFlowSequence[sequenceIndex]);
            SequenceIndex = (sequenceIndex + 1) % baseNumberFlowSequence.length;

            Let possiblePatterns = [
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                [0,6,12,18,24], [4,8,12,16,20],
                [0,4,20,24]
            ];

            Let sharedPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];

            Let primaryCardList = getCartelaNumbers(winningCardNums[0]);
            Let primaryPatternNumbers = sharedPattern
                .map(idx => primaryCardList[idx])
                .filter(n => n !== "FREE")
                .map(n => Number(n));

            Let shuffledPatternNums = [...primaryPatternNumbers].sort(() => 0.5 - Math.random());
            Let finalWinningBall = shuffledPatternNums.pop(); 
            Let earlyPatternBalls = shuffledPatternNums;     

            Let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
            AvailableNumbers.sort(() => 0.5 - Math.random());
            
            AvailableNumbers = availableNumbers.filter(n => !primaryPatternNumbers.includes(n));

            Let totalPreCalls = Math.max(earlyPatternBalls.length, targetCallCount - 1);
            Let preCallSchedule = new Array(totalPreCalls).fill(null);

            Let slotIndices = Array.from({length: totalPreCalls}, (_, i) => i).sort(() => 0.5 - Math.random());
            EarlyPatternBalls.forEach((ball, i) => {
                PreCallSchedule[slotIndices[i]] = ball;
            });

            Io.emit('gameStarted', { calledNumbers: [] });
            Io.emit('gameStartedBroadcast');

            If (numberCallInterval) clearInterval(numberCallInterval);
            
            Let callStep = 0;

            NumberCallInterval = setInterval(() => {
                If (!globalRoom.gameActive) {
                    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    Return;
                }

                Let calledNum;

                If (callStep < totalPreCalls) {
                    If (preCallSchedule[callStep] !== null) {
                        CalledNum = preCallSchedule[callStep];
                    } else {
                        Let safeIndex = availableNumbers.findIndex(testNum => {
                            Let tempCalled = [...globalRoom.calledNumbers, testNum];
                            Let realWins = false;
                            Object.values(globalRoom.playerRoundCards).forEach(pData => {
                                If (pData && pData.cards) {
                                    PData.cards.forEach(cNum => {
                                        If (getWinningMatchedIndices(getCartelaNumbers(cNum), tempCalled)) {
                                            RealWins = true;
                                        }
                                    });
                                }
                            });
                            Return !realWins;
                        });

                        If (safeIndex !== -1) {
                            CalledNum = availableNumbers.splice(safeIndex, 1)[0];
                        } else {
                            CalledNum = availableNumbers.shift();
                        }
                    }
                    CallStep++;

                    If (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                        GlobalRoom.calledNumbers.push(Number(calledNum));
                        GlobalRoom.lastCalledNumber = Number(calledNum);

                        Io.emit('numberCalled', {
                            Number: Number(calledNum),
                            CalledNumbers: globalRoom.calledNumbers
                        });
                        Io.emit('numberCalledBroadcast', Number(calledNum));
                    }
                    Return;
                }

                If (callStep === totalPreCalls) {
                    CallStep++;
                    CalledNum = finalWinningBall;

                    If (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                        GlobalRoom.calledNumbers.push(Number(calledNum));
                        GlobalRoom.lastCalledNumber = Number(calledNum);

                        Io.emit('numberCalled', {
                            Number: Number(calledNum),
                            CalledNumbers: globalRoom.calledNumbers
                        });
                        Io.emit('numberCalledBroadcast', Number(calledNum));
                    }

                    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }

                    WinGraceTimeout = setTimeout(() => {
                        If (!globalRoom.gameActive) return;

                        Let finalWinnersList = winningSocketData.map((item, idx) => {
                            Let cNum = winningCardNums[idx];
                            Let cList = getCartelaNumbers(cNum);
                            Let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers) || sharedPattern;
                            Return {
                                Username: winningUsernamesArr[idx],
                                SocketId: item.socketId,
                                UserId: item.userId,
                                IsBot: item.isBot,
                                CardNum: cNum,
                                Matched: matched
                            };
                        });

                        AnnounceWinnersAndFinish(finalWinnersList);
                    }, 6000);
                }

            }, 4500); 
        }
    }, 1000);
}

Function endRoundAndRestart() {
    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    If (winGraceTimeout) { clearTimeout(winGraceTimeout); winGraceTimeout = null; }
    GlobalRoom.gameActive = false;
    GlobalRoom.calledNumbers = []; 
    GlobalRoom.lastCalledNumber = null;
    
    GlobalRoom.playerRoundCards = {}; 
    GlobalRoom.playerTemporaryCards = {};
    GlobalRoom.takenCards = [];

    GlobalRoom.gameStartTime = Date.now() + 60000; 
    GlobalRoom.forcedWinningCardNums = [];
    
    Io.emit('roundEnded', { nextGameIn: 60000 });
    Io.emit('gameEndedBroadcast');
    RefreshTakenCardsList();
}

StartMainGameLoop();

Let telegramOffset = 0;
Async function pollTelegramUpdates() {
    If (!TELEGRAM_BOT_TOKEN) return;
    Try {
        Let response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`, {
            Params: { offset: telegramOffset, timeout: 30 }
        });
        If (response.data && response.data.ok) {
            Let updates = response.data.result;
            For (let update of updates) {
                TelegramOffset = update.update_id + 1;
                
                Let nowTs = Date.now();
                Object.keys(pendingRequests).forEach(k => {
                    If (nowTs - pendingRequests[k].timestamp > 86400000) {
                        Delete pendingRequests[k];
                    }
                });

                If (update.message && update.message.text) {
                    Let msgText = update.message.text.trim();
                    Let senderChatId = String(update.message.chat.id);
                    
                    If (ADMIN_CHAT_IDS.includes(senderChatId)) {
                        Let parts = msgText.split(' ');
                        Let cmd = parts[0].toLowerCase();
                        Let targetUserId = parts[1] ? String(parts[1]).trim() : null;

                        If (cmd === '/settelebirr' && parts[1]) {
                            Let newPhone = parts[1];
                            Let newName = parts.slice(2).join(' ') || telebirrConfig.name;
                            
                            TelebirrConfig.phone = newPhone;
                            TelebirrConfig.name = newName;

                            SaveTelebirrConfigToDisk();
                            Io.emit('telebirrConfigUpdated', telebirrConfig);

                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                Chat_id: senderChatId,
                                Text: `✅ የቴሌብር ቁጥር በተሳካ ሁኔታ ተቀይሯል!\n📱 ቁጥር: \`${newPhone}\`\n👤 ስም: *${newName}*`,
                                Parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        If ((cmd === '/bonus20' || cmd === '/bonus50') && targetUserId) {
                            Let bonusAmount = cmd === '/bonus20' ? 20 : 50;
                            
                            UserWallets[targetUserId] = (userWallets[targetUserId] || 0) + bonusAmount;

                            Let targetUserSocketObj = onlineRealUsers.find(u => u.userId === targetUserId);
                            Let bonusPayload = {
                                Type: 'bonus',
                                Amount: bonusAmount,
                                AdjustedAmount: bonusAmount,
                                Balance: userWallets[targetUserId]
                            };

                            If (targetUserSocketObj) {
                                Let targetSocket = io.sockets.sockets.get(targetUserSocketObj.socketId);
                                If (targetSocket) {
                                    TargetSocket.emit('financialApproved', bonusPayload);
                                    
                                    For (let adminChatId of ADMIN_CHAT_IDS) {
                                        Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                            Chat_id: adminChatId,
                                            Text: `✅ በተሳካ ሁኔታ ለዩዘር ID: \`${targetUserId}\` የ **${bonusAmount} ብር** ቦነስ ተልኳል!`,
                                            Parse_mode: 'Markdown'
                                        }).catch(() => {});
                                    }
                                }
                            } else {
                                If (!offlineApprovedQueue[targetUserId]) {
                                    OfflineApprovedQueue[targetUserId] = [];
                                }
                                OfflineApprovedQueue[targetUserId].push(bonusPayload);

                                For (let adminChatId of ADMIN_CHAT_IDS) {
                                    Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                        Chat_id: adminChatId,
                                        Text: `📌 ዩዘር ID: \`${targetUserId}\` ኦንላይን አይደለም። አፕ ሲከፍት ቦነሱ በራስ-ሰር አካውንቱ ላይ ይገባል!`,
                                        Parse_mode: 'Markdown'
                                    }).catch(() => {});
                                }
                            }
                        }
                    }
                }

                // --- Telegram Callback Query (Admin Approve / Reject Syncing) ---
                If (update.callback_query) {
                    Let callbackQuery = update.callback_query;
                    Let data = callbackQuery.data; 
                    Let chatId = callbackQuery.message.chat.id;
                    Let messageId = callbackQuery.message.message_id;
                    
                    Let parts = data.split('_');
                    Let action = parts[0]; 
                    Let requestId = parts.slice(1).join('_');
                    Let reqData = pendingRequests[requestId];

                    // 💡 ሪኩዌስቱ አስቀድሞ የተጠናቀቀ ወይም ያልተገኘ ከሆነ
                    If (!reqData) {
                        Try {
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { 
                                Callback_query_id: callbackQuery.id,
                                Text: "⚠️ ይህ ጥያቄ አስቀድሞ በሌላ አድሚን ጸድቋል ወይም ተሰርዟል!",
                                Show_alert: true 
                            });
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                                Chat_id: chatId,
                                Message_id: messageId,
                                Reply_markup: { inline_keyboard: [] }
                            });
                        } catch (e) {}
                        Continue;
                    }

                    Let targetSocket = io.sockets.sockets.get(reqData.socketId);
                    Let reqType = String(reqData.type || 'deposit').toLowerCase().trim();
                    Let rawAmount = Number(reqData.amount) || 0;
                    Let finalAmountForClient = (reqType === 'withdraw' || reqType === 'withdrawal') ? -Math.abs(rawAmount) : Math.abs(rawAmount);

                    If (action === 'app') {
                        If (reqType === 'deposit' || reqType === 'bonus') {
                            UserWallets[reqData.userId] = (userWallets[reqData.userId] || 0) + Math.abs(rawAmount);
                        } else if (reqType === 'withdraw' || reqType === 'withdrawal') {
                            UserWallets[reqData.userId] = (userWallets[reqData.userId] || 0) - Math.abs(rawAmount);
                        }

                        Let successPayload = { 
                            Type: reqData.type, 
                            Amount: rawAmount, 
                            AdjustedAmount: finalAmountForClient,
                            Balance: userWallets[reqData.userId]
                        };

                        If (targetSocket) {
                            TargetSocket.emit('financialApproved', successPayload);
                        } else {
                            If (!offlineApprovedQueue[reqData.userId]) {
                                OfflineApprovedQueue[reqData.userId] = [];
                            }
                            OfflineApprovedQueue[reqData.userId].push(successPayload);
                        }

                        If (reqData.chatId) {
                            Let successMsg = `🎉 *AZ BINGO - የገንዘብ ጥያቄዎ ጸድቋል!*\n\nሰላም *${reqData.username}*፣ የጠየቁት ${rawAmount} ብር ተስተካክሏል። እናመሰግናለን! 🙏`;
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                Chat_id: reqData.chatId,
                                Text: successMsg,
                                Parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        // 💡 ማረጋገጫ: ጥያቄው መጸደቁን የሚያሳይ ግልጽ ጽሁፍ በሁለቱም አድሚኖች ቻት ላይ ይቀመጣል
                        Let approvedFinalText = `✅ *ጥያቄው ተረጋግጦ ጸድቋል!* \n👤 ስም: *${reqData.username}*\n🆔 ዩዘር ID: \`${reqData.userId}\`\n💰 መጠን: *${reqData.amount} ብር*\n⏱ የላከበት ሰዓት: _${reqData.requestTimeStr || 'N/A'}_\n🆔 ሪኩዌስት ID: \`${requestId}\`\n✨ *(ሁኔታ: በአድሚን ጸድቆ ተጠናቋል)*`;

                        For (let adminId of ADMIN_CHAT_IDS) {
                            Try {
                                Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
                                    Chat_id: adminId, message_id: messageId,
                                    Caption: approvedFinalText, parse_mode: 'Markdown',
                                    Reply_markup: { inline_keyboard: [] }
                                });
                            } catch (err) {
                                Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                    Chat_id: adminId, message_id: messageId,
                                    Text: approvedFinalText, parse_mode: 'Markdown',
                                    Reply_markup: { inline_keyboard: [] }
                                }).catch(() => {});
                            }
                        }

                    } else {
                        If (reqData.chatId) {
                            Let rejectMsg = `❌ *AZ BINGO - የገንዘብ ጥያቄዎ ተሰርዟል!*\n\nሰላም *${reqData.username}*፣ የጠየቁት የክፍያ ጥያቄ (${reqData.amount} ብር) በአድሚኑ ተሰርዟል።\n\n⚠️ *ምክንያት:* ያስገቡት ደረሰኝ ወይም መረጃ ልክ አይደለም። እባክዎ ትክክለኛውን ደረሰኝ በማስገባት እንደገና ይሞክሩ። 🙏`;
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                Chat_id: reqData.chatId,
                                Text: rejectMsg,
                                Parse_mode: 'Markdown'
                            }).catch(() => {});
                        }

                        If (targetSocket) { 
                            TargetSocket.emit('financialRejected', { type: reqData.type, amount: rawAmount }); 
                        }

                        Let rejectedFinalText = `❌ *ጥያቄው ተሰርዟል!* \n👤 ስም: *${reqData.username}*\n🆔 ዩዘር ID: \`${reqData.userId}\`\n💰 መጠን: *${reqData.amount} ብር*\n⏱ የላከበት ሰዓት: _${reqData.requestTimeStr || 'N/A'}_\n🆔 ሪኩዌስት ID: \`${requestId}\`\n⚠️ *(ሁኔታ: በአድሚን ተሰርዟል)*`;

                        For (let adminId of ADMIN_CHAT_IDS) {
                            Try {
                                Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
                                    Chat_id: adminId, message_id: messageId,
                                    Caption: rejectedFinalText, parse_mode: 'Markdown',
                                    Reply_markup: { inline_keyboard: [] }
                                });
                            } catch (err) {
                                Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                    Chat_id: adminId, message_id: messageId,
                                    Text: rejectedFinalText, parse_mode: 'Markdown',
                                    Reply_markup: { inline_keyboard: [] }
                                }).catch(() => {});
                            }
                        }
                    }

                    Delete pendingRequests[requestId]; 

                    Try { 
                        Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: callbackQuery.id }); 
                    } catch (e) {}
                }
            }
        }
    } catch (err) {}
    SetTimeout(pollTelegramUpdates, 1000);
}
SetTimeout(pollTelegramUpdates, 2000);

Async function sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt) {
    If (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_IDS.length) return;
    Let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    Let requestTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });

    Let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}\n⏱ የላከበት ሰዓት: _${requestTimeStr}_\n🆔 ሪኩዌስት ID: \`${requestId}\``;
    If (receipt) message += `\n\n📄 *ደረሰኝ / SMS:*\n\`${receipt}\``;
    
    For (let adminChatId of ADMIN_CHAT_IDS) {
        Try {
            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                Chat_id: adminChatId, text: message, parse_mode: 'Markdown',
                Reply_markup: { 
                    Inline_keyboard: [
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

App.post('/api/financial-request', async (req, bodyRes) => {
    Try {
        Let { type, amount, username, userId, currentBalance, receiptText, receiptImage } = req.body;

        If (type === 'deposit' && isDepositLocked) {
            Return bodyRes.json({ success: false, message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
        }

        Let requestId = 'req_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        Let requestTimeStr = new Date().toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
        
        PendingRequests[requestId] = { 
            UserId: String(userId || 'unknown'), 
            ChatId: userId, 
            Type, 
            Amount, 
            Username, 
            SocketId: null, 
            Timestamp: Date.now(),
            RequestTimeStr: requestTimeStr
        };

        Let caption = `🔔 *AZ BINGO - 💳 ቴሌብር ዲፖዚት*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n⏱ የላከበት ሰዓት: _${requestTimeStr}_\n🆔 ሪኩዌስት ID: \`${requestId}\``;
        
        If (receiptText) {
            Caption += `\n\n📄 *የደረሰኝ ጽሑፍ (SMS):*\n\`${receiptText}\``;
        }

        For (let adminChatId of ADMIN_CHAT_IDS) {
            Try {
                If (receiptImage && receiptImage.startsWith('data:image')) {
                    Let base64Data = receiptImage.replace(/^data:image\/\w+;base64,/, "");
                    Let buffer = Buffer.from(base64Data, 'base64');
                    
                    Let formDataTelegram = new (require('form-data'))();
                    FormDataTelegram.append('chat_id', adminChatId);
                    FormDataTelegram.append('photo', buffer, { filename: 'receipt.jpg' });
                    FormDataTelegram.append('caption', caption);
                    FormDataTelegram.append('parse_mode', 'Markdown');
                    FormDataTelegram.append('reply_markup', JSON.stringify({
                        Inline_keyboard: [
                            [
                                { text: "✅ አጽድቅ", callback_data: "app_" + requestId }, 
                                { text: "❌ ሰርዝ", callback_data: "rej_" + requestId }
                            ]
                        ]
                    }));

                    Axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, formDataTelegram, {
                        Headers: formDataTelegram.getHeaders()
                    }).catch(() => {});
                } else {
                    Axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        Chat_id: adminChatId, 
                        Text: caption, 
                        Parse_mode: 'Markdown',
                        Reply_markup: { 
                            Inline_keyboard: [
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

        BodyRes.json({ success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    } catch (err) {
        BodyRes.status(500).json({ success: false, message: err.message });
    }
});

Io.on('connection', (socket) => {
    ConnectedRealPlayers.push(socket.id);
    UpdateRoomPlayersAndPot();
    Socket.emit('syncGameState', globalRoom);
    RefreshTakenCardsList();

    Socket.emit('financialLockStatus', { isDepositLocked, isWithdrawLocked });
    Socket.emit('telebirrConfigUpdated', telebirrConfig);
    Socket.emit('botConfigUpdated', botConfig); 

    Socket.on('registerRealUser', (userData) => {
        If (userData && userData.userId) {
            Let userId = String(userData.userId);
            
            AllRegisteredUsers.add(userId);

            Let clientBalance = userData.balance !== undefined ? parseFloat(userData.balance) : 0;
            If (userWallets[userId] === undefined) {
                UserWallets[userId] = clientBalance;
            } else {
                If (clientBalance > userWallets[userId]) {
                    UserWallets[userId] = clientBalance;
                }
            }

            If (globalRoom.gameActive) {
                Let existingKey = Object.keys(globalRoom.playerRoundCards).find(sId => globalRoom.playerRoundCards[sId].userId === userId);
                If (existingKey) {
                    Let existingData = globalRoom.playerRoundCards[existingKey];
                    Delete globalRoom.playerRoundCards[existingKey];
                    GlobalRoom.playerRoundCards[socket.id] = existingData;
                }
            } else {
                Object.keys(globalRoom.playerRoundCards).forEach(sId => {
                    If (globalRoom.playerRoundCards[sId].userId === userId) {
                        Delete globalRoom.playerRoundCards[sId];
                    }
                });
            }

            Delete globalRoom.playerTemporaryCards[socket.id];

            OnlineRealUsers = onlineRealUsers.filter(u => u.userId !== userId);
            OnlineRealUsers.push({ socketId: socket.id, userId: userId, username: userData.username || 'No Username', fullName: userData.fullName || 'ተጫዋች' });
            
            If (!claimedWelcomeBonusUsers.has(userId) && userWallets[userId] === 0) {
                ClaimedWelcomeBonusUsers.add(userId);
                UserWallets[userId] += 20;
                Socket.emit('welcomeBonusGranted', { 
                    Amount: 20, 
                    Balance: userWallets[userId],
                    Message: "እንኳን ደህና መጡ! የመጀመሪያ የአንድ ጊዜ የ20 ብር ቦነስ ተሰጥቷል!" 
                });
            } else {
                ClaimedWelcomeBonusUsers.add(userId);
            }

            If (offlineApprovedQueue[userId] && offlineApprovedQueue[userId].length > 0) {
                OfflineApprovedQueue[userId].forEach(item => {
                    Socket.emit('financialApproved', item);
                });
                Delete offlineApprovedQueue[userId];
            }

            Socket.emit('updateBalance', { balance: userWallets[userId] });

            RefreshTakenCardsList();
            UpdateRoomPlayersAndPot();
            Socket.emit('syncGameState', globalRoom);
        }
    });

    Socket.on('playerClaimBingo', (data) => {
        If (!globalRoom.gameActive) return;
        Let userId = String(data.userId);
        Let cardNum = data.cardNum;
        
        Let cList = getCartelaNumbers(cardNum);
        Let matched = getWinningMatchedIndices(cList, globalRoom.calledNumbers);
        
        If (matched) {
            AnnounceWinnersAndFinish([{
                Username: data.username || 'ተጫዋች',
                SocketId: socket.id,
                UserId: userId,
                IsBot: false,
                CardNum: cardNum,
                Matched: matched
            }]);
        } else {
            Socket.emit('cardSelectionError', "⚠️ ማሳሰቢያ፡ የእርስዎ ካርድ ገና ሙሉ ማሸነፊያ (Pattern) አላሟላም!");
        }
    });

    Socket.on('getAdminRealUsers', () => {
        Socket.emit('adminRealUsersListUpdate', onlineRealUsers);
    });

    Socket.on('adminCheckUserBalance', (data) => {
        If (data && data.targetUserId) {
            Let tId = String(data.targetUserId).trim();
            Let foundBalance = 0.00;
            If (userWallets[tId] !== undefined) {
                FoundBalance = parseFloat(userWallets[tId]);
            } else {
                Let matchedKey = Object.keys(userWallets).find(k => String(k).trim() === tId);
                If (matchedKey) {
                    FoundBalance = parseFloat(userWallets[matchedKey]);
                }
            }
            
            Socket.emit('adminUserBalanceResponse', { 
                Success: true, 
                TargetUserId: tId, 
                Balance: foundBalance,
                Message: `👤 ዩዘር ID (${tId}) ቀሪ ሂሳብ: ${foundBalance} ብር` 
            });
        }
    });

    Socket.on('adminToggleLock', (data) => {
        If (data.type === 'deposit') {
            IsDepositLocked = data.locked;
        } else if (data.type === 'withdraw') {
            IsWithdrawLocked = data.locked;
        }
        Io.emit('financialLockStatus', { isDepositLocked, isWithdrawLocked });
        Socket.emit('adminLockResponse', { success: true, message: `✅ የተሳካ ሁኔታ ተቀይሯል!` });
    });

    Socket.on('adminUpdateTelebirr', (data) => {
        If (data && data.phone) {
            TelebirrConfig.phone = data.phone;
            If (data.name) telebirrConfig.name = data.name;

            SaveTelebirrConfigToDisk();
            Io.emit('telebirrConfigUpdated', telebirrConfig);
            Socket.emit('adminTelebirrResponse', { success: true, message: `✅ የቴሌብር ቁጥር ተቀይሯል!` });
        }
    });

    Socket.on('adminUpdateBotConfig', (data) => {
        If (data && data.minBots !== undefined && data.maxBots !== undefined) {
            Let minB = parseInt(data.minBots);
            Let maxB = parseInt(data.maxBots);

            If (!isNaN(minB) && !isNaN(maxB)) {
                If (minB < 1) minB = 1;
                If (maxB < minB) maxB = minB;

                BotConfig.minBots = minB;
                BotConfig.maxBots = maxB;

                SaveBotConfigToDisk();
                Io.emit('botConfigUpdated', botConfig);
                UpdateRoomPlayersAndPot();

                Socket.emit('adminBotResponse', { success: true, message: `✅ የቦቶች ብዛት (Min: ${minB}, Max: ${maxB}) ተስተካክሏል!` });
            } else {
                Socket.emit('adminBotResponse', { success: false, message: `⚠️ እባክዎ ትክክለኛ ቁጥሮችን ያስገቡ!` });
            }
        }
    });

    Socket.on('adminSendBonus', (data) => {
        If (socket.id) {
            Let targetUserId = String(data.targetUserId).trim();
            Let bonusAmount = Number(data.amount) || 20;

            UserWallets[targetUserId] = (userWallets[targetUserId] || 0) + bonusAmount;

            Let bonusPayload = {
                Type: 'bonus',
                Amount: bonusAmount,
                AdjustedAmount: bonusAmount,
                Balance: userWallets[targetUserId]
            };

            Let targetUserSocketObj = onlineRealUsers.find(u => u.userId === targetUserId);
            If (targetUserSocketObj) {
                Let targetSocket = io.sockets.sockets.get(targetUserSocketObj.socketId);
                If (targetSocket) {
                    TargetSocket.emit('financialApproved', bonusPayload);
                    Socket.emit('adminBonusResponse', { success: true, message: `✅ ለዩዘር ID (${targetUserId}) ${bonusAmount} ብር ቦነስ ተልኮ አካውንቱ ላይ ገቢ ሆኗል!` });
                }
            } else {
                If (!offlineApprovedQueue[targetUserId]) {
                    OfflineApprovedQueue[targetUserId] = [];
                }
                OfflineApprovedQueue[targetUserId].push(bonusPayload);
                Socket.emit('adminBonusResponse', { success: true, message: `📌 ዩዘሩ ኦንላይን አይደለም። አፕ ሲከፍት የ ${bonusAmount} ብር ቦነሱ በራስ-ሰር አካውንቱ ላይ ይገባል!` });
            }
        }
    });

    Socket.on('adminBroadcastMessage', async (data) => {
        Let messageText = data ? data.message : null;
        
        If (!messageText) {
            Socket.emit('adminBroadcastResponse', { success: false, message: "⚠️ እባክዎ የሚላከውን መልእክት ይጻፉ!" });
            Return;
        }

        Let allUserIds = [...allRegisteredUsers];

        (async () => {
            For (let uId of allUserIds) {
                Try {
                    Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        Chat_id: uId,
                        Text: `📢 *AZ BINGO - ማስታወቂያ*\n\n${messageText}`,
                        Parse_mode: 'Markdown'
                    });
                    Await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {}
            }
        })();

        Socket.emit('adminBroadcastResponse', { 
            Success: true, 
            Message: `✅ ማስታወቂያው ለተጠቃሚዎች በሂደት ላይ ይላካል! (አጠቃላይ ተመዝጋቢዎች: ${allUserIds.length})` 
        });
    });

    Socket.on('tempSelectCards', (cards) => {
        If (Array.isArray(cards)) {
            GlobalRoom.playerTemporaryCards[socket.id] = cards;
            RefreshTakenCardsList();
        }
    });

    Socket.on('confirmCards', (data) => {
        If (data && data.cards && Array.isArray(data.cards)) {
            GlobalRoom.playerRoundCards[socket.id] = {
                Cards: data.cards,
                Username: data.username || 'ተጫዋች',
                UserId: data.userId || 'unknown'
            };
            If (globalRoom.playerTemporaryCards[socket.id]) {
                Delete globalRoom.playerTemporaryCards[socket.id];
            }
            RefreshTakenCardsList();
            UpdateRoomPlayersAndPot();
            Socket.emit('cardSelectionSuccess');
        }
    });

    Socket.on('adminSetNextWinner', (data) => {
        Let winnerType = data.winnerType ? String(data.winnerType).trim() : null;
        
        If (winnerType === 'only_real_users_mode') {
            EnableOnlyRealUsersMode = true;
            ForcedNextWinner = 'random_real';
            UpdateRoomPlayersAndPot();
            Socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [ሪል ዩዘሮች ብቻ - True Random] ተቀይሯል!` });
        } else if (winnerType === 'standard_bot_mode') {
            EnableOnlyRealUsersMode = false;
            ForcedNextWinner = null;
            UpdateRoomPlayersAndPot();
            Socket.emit('adminWinnerResponse', { success: true, message: `✅ ሁነታው ወደ [መደበኛ (ቦቶች + ሪል)] ተመለሰ!` });
        } else {
            ForcedNextWinner = winnerType;
            Socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
        }
    });

    Socket.on('financialRequest', async (data) => {
        Data.type = data.type || 'deposit';
        Let { type, amount, username, userId, currentBalance, phone, receipt, telegramChatId } = data;
        
        If ((type === 'withdraw' || type === 'withdrawal') && isWithdrawLocked) {
            Socket.emit('financialError', { message: "⚠️ ለጊዜው በሲስተም ጥገና ምክንያት አገልግሎት አይሰጥም!" });
            Return;
        }

        Let requestId = 'req_' + socket.id.substring(0, 5) + '_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        
        PendingRequests[requestId] = { 
            UserId: String(userId || 'unknown'), 
            ChatId: telegramChatId || userId, 
            Type, 
            Amount, 
            Username, 
            SocketId: socket.id, 
            Timestamp: Date.now() 
        };

        SendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt);
        Socket.emit('requestSubmitted', { success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    });

    Socket.on('disconnect', () => {
        ConnectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        OnlineRealUsers = onlineRealUsers.filter(u => u.socketId !== socket.id);
        
        If (!globalRoom.gameActive) {
            Delete globalRoom.playerRoundCards[socket.id];
        }
        Delete globalRoom.playerTemporaryCards[socket.id];
        
        RefreshTakenCardsList();
        UpdateRoomPlayersAndPot();
    });
});

Const PORT = process.env.PORT || 3000;
Server.listen(PORT, () => {
    Console.log("AZ Server running on port " + PORT);
});
