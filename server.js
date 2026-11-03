Const express = require('express');
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
    Res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    TargetWinCallCount: 25,
    ForcedWinningCardNums: []
};

Let forcedNextWinner = null; 
Let onlineRealUsers = [];
Let pendingRequests = {};
Let gameInterval = null;
Let numberCallInterval = null;

function getCartelaNumbers(cardNum) {
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

function getWinningMatchedIndices(winningCardNumbers, calledNumbers) {
    Let grid2D = [];
    Let cleanCalled = (calledNumbers || []).map(n => Number(n));
    
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

    Let fallbackMatched = [];
    Grid2D.forEach(row => {
        Row.forEach(cell => {
            If (cell.isHit) fallbackMatched.push(cell.idx);
        });
    });
    Return fallbackMatched;
}

function getRealisticBotsCount(realCount) {
    Const now = new Date();
    Let utcHours = now.getUTCHours();
    Let utcMinutes = now.getUTCMinutes();
    Let ethiopianHour = (utcHours + 3) % 24; 
    Let totalMinutesFrom16 = ((ethiopianHour - 16 + 24) % 24) * 60 + utcMinutes;
    Let maxDurationMinutes = 8 * 60;
    Let calculated = 95;

    If (ethiopianHour >= 6 && ethiopianHour < 12) {
        Calculated = 45 + Math.floor(Math.random() * 15);
    } else if (ethiopianHour >= 12 && ethiopianHour < 19) {
        Calculated = 70 + Math.floor(Math.random() * 20);
    } else {
        Let progress = Math.min(1, Math.max(0, totalMinutesFrom16 / maxDurationMinutes));
        Calculated = Math.floor(100 + (progress * 130) + (Math.sin(Date.now() / 3000) * 15));
    }

    Let smallDelta = Math.floor(Math.random() * 7) - 3; 
    Let finalCount = calculated + smallDelta;
    If (finalCount < 40) finalCount = 40;
    If (finalCount > 250) finalCount = 250;
    Return finalCount;
}

function refreshTakenCardsList() {
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

function simulateBotCardSelections() {
    If (globalRoom.gameActive) return;
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

setInterval(simulateBotCardSelections, 6000);

async function sendWinnerNotificationToAdmin(winnerNamesStr, cardNum, prizePerWinner, isRealUser) {
    If (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID || !isRealUser) return;
    Let message = `🏆 *AZ BINGO - 👤 አሸናፊ(ዎች)*\n\n🎉 አሸናፊዎች: *${winnerNamesStr}*\n🔢 ዋና ካርድ ቁጥር: \`#${cardNum}\`\n💰 የተሸለመው የድርሻ ብር (ለእያንዳንዱ): *${prizePerWinner} ብር*\n👥 ተጫዋቾች ብዛት: ${globalRoom.playersCount}`;
    Try {
        Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            Chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown'
        });
    } catch (error) {}
}

function startMainGameLoop() {
    If (gameInterval) clearInterval(gameInterval);
    GlobalRoom.gameStartTime = Date.now() + 60000;

    GameInterval = setInterval(() => {
        Let timeLeft = globalRoom.gameStartTime - Date.now();

        If (timeLeft <= 0 && !globalRoom.gameActive) {
            GlobalRoom.gameActive = true;
            GlobalRoom.calledNumbers = [];
            GlobalRoom.lastCalledNumber = null;
            
            Let activeRealEntries = Object.entries(globalRoom.playerRoundCards).filter(([socketId, data]) => data.cards && data.cards.length > 0);
            Let currentWinnerType = forcedNextWinner;
            ForcedNextWinner = null; 

            Let winningUsernamesArr = [];
            Let winningSocketData = []; 
            Let winnersCount = 1; 
            Let winningCardNums = [];

            // **ጥብቅ ሎጂክ: አድሚን ካላዘዘ በስተቀር ሪያል ዩዘር አያሸንፍም (Strict Admin/Bot Control)**
            Let isForcedRealWin = (currentWinnerType === 'real_user' || currentWinnerType === 'single_real' || currentWinnerType === 'random_real' || currentWinnerType === 'random_3_real' || currentWinnerType === 'multi_real_3');

            If (isForcedRealWin && activeRealEntries.length > 0) {
                // አድሚን ሪያል ዩዘር እንዲያሸንፍ ሲያዝ
                Let targetRealCount = (currentWinnerType.includes('3') ? 3 : 1);
                Let shuffledReal = [...activeRealEntries].sort(() => 0.5 - Math.random());
                Let chosenReal = shuffledReal.slice(0, targetRealCount);
                ChosenReal.forEach(item => {
                    WinningUsernamesArr.push(item[1].username);
                    WinningSocketData.push({ socketId: item[0], isBot: false });
                    WinningCardNums.push(item[1].cards && item[1].cards.length > 0 ? item[1].cards[0] : Math.floor(Math.random() * 450) + 1);
                });
                WinnersCount = winningUsernamesArr.length;
            } else {
                // በነባሪ ጨዋታ ቦቶች ብቻ እንዲያሸንፉ ይደረጋል (ሪያል ዩዘሮች በምንም ተአምር በራሳቸው አያሸንፉም)
                Let targetBotCount = (currentWinnerType === 'dual_bot' ? 2 : 1);
                For (let i = 0; i < targetBotCount; i++) {
                    Let bName = getRandomBotNames(1)[0];
                    WinningUsernamesArr.push(bName);
                    WinningSocketData.push({ socketId: null, isBot: true });
                    WinningCardNums.push(Math.floor(Math.random() * 450) + 1);
                }
                WinnersCount = targetBotCount;
            }

            GlobalRoom.forcedWinningCardNums = winningCardNums;
            
            Let rotationPool = [
                12, 13, 14, 15, 16, 17, 18, 18, 18, 19, 19, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 28, 28, 29, 30,
                35, 36, 37
            ];
            Let targetCallCount = rotationPool[Math.floor(Math.random() * rotationPool.length)];

            Let possiblePatterns = [
                [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
                [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
                [0,6,12,18,24], [4,8,12,16,20],
                [0,4,20,24]
            ];

            Let perWinnerConfigs = winningCardNums.map(cNum => {
                Let cList = getCartelaNumbers(cNum);
                Let p = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
                Let reqNums = p.map(idx => cList[idx]).filter(n => n !== "FREE");
                Return { cardNum: cNum, cartelaList: cList, patternIndices: p, requiredNumbers: reqNums };
            });

            Let interleavedWinningNumbers = [];
            Let maxLength = Math.max(...perWinnerConfigs.map(cfg => cfg.requiredNumbers.length));
            
            For (let i = 0; i < maxLength; i++) {
                PerWinnerConfigs.forEach(cfg => {
                    If (cfg.requiredNumbers[i] !== undefined && !interleavedWinningNumbers.includes(cfg.requiredNumbers[i])) {
                        InterleavedWinningNumbers.push(cfg.requiredNumbers[i]);
                    }
                });
            }

            If (interleavedWinningNumbers.length > targetCallCount) {
                InterleavedWinningNumbers = interleavedWinningNumbers.slice(0, targetCallCount);
            }

            Let availableNumbers = Array.from({length: 75}, (_, i) => i + 1);
            
            Io.emit('gameStarted', { calledNumbers: [] });
            Io.emit('gameStartedBroadcast');

            If (numberCallInterval) clearInterval(numberCallInterval);
            
            Let winNumQueue = [...interleavedWinningNumbers];

            NumberCallInterval = setInterval(() => {
                If (!globalRoom.gameActive) {
                    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    Return;
                }

                Let reachedTargetLimit = (globalRoom.calledNumbers.length >= targetCallCount);
                
                Let realUserCompleted = false;
                If (isForcedRealWin) {
                    PerWinnerConfigs.forEach((cfg, idx) => {
                        Let matchedIdxs = getWinningMatchedIndices(cfg.cartelaList, globalRoom.calledNumbers);
                        Let isPatternDone = cfg.patternIndices.every(pIdx => matchedIdxs.includes(pIdx));
                        If (!winningSocketData[idx].isBot && isPatternDone) {
                            RealUserCompleted = true;
                        }
                    });
                }
                
                Let shouldTriggerWin = (reachedTargetLimit || (isForcedRealWin && realUserCompleted));
                
                If (shouldTriggerWin) {
                    Let totalPot = (globalRoom.playersCount || 140) * 10;
                    Let prizePerWinner = Math.floor(((totalPot * 0.90) / winnersCount));

                    Let primaryCardNum = winningCardNums[0];
                    Let winningCardNumbers = getCartelaNumbers(primaryCardNum);
                    Let matchedIndices = getWinningMatchedIndices(winningCardNumbers, globalRoom.calledNumbers);

                    Let winnerNamesStr = winningUsernamesArr.join(', ');
                    Let hasRealWinner = winningSocketData.some(i => !i.isBot);
                    
                    SendWinnerNotificationToAdmin(winnerNamesStr, primaryCardNum, prizePerWinner, hasRealWinner);

                    WinningSocketData.forEach(item => {
                        If (!item.isBot && item.socketId) {
                            Let targetSocket = io.sockets.sockets.get(item.socketId);
                            If (targetSocket) {
                                TargetSocket.emit('rewardPrize', { prize: prizePerWinner });
                            }
                        }
                    });

                    Io.emit('bingoWinner', {
                        Username: winnerNamesStr,
                        UserId: winningSocketData.find(i => !i.isBot)?.socketId || null,
                        CardNum: primaryCardNum,
                        Prize: prizePerWinner,
                        CalledNumbers: globalRoom.calledNumbers,
                        MatchedIndices: matchedIndices,
                        WinnersCount: winnersCount,
                        PlayersCount: globalRoom.playersCount
                    });

                    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
                    
                    SetTimeout(() => { endRoundAndRestart(); }, 6000);
                    Return;
                }

                Let calledNum;
                If (winNumQueue.length > 0) {
                    CalledNum = Number(winNumQueue.shift());
                    Let availIdx = availableNumbers.indexOf(calledNum);
                    If (availIdx > -1) availableNumbers.splice(availIdx, 1);
                } else {
                    Let randIdx = Math.floor(Math.random() * availableNumbers.length);
                    CalledNum = availableNumbers.splice(randIdx, 1)[0];
                }

                If (calledNum !== undefined && !globalRoom.calledNumbers.includes(Number(calledNum))) {
                    GlobalRoom.calledNumbers.push(Number(calledNum));
                    GlobalRoom.lastCalledNumber = Number(calledNum);

                    Io.emit('numberCalled', {
                        Number: Number(calledNum),
                        CalledNumbers: globalRoom.calledNumbers
                    });
                    Io.emit('numberCalledBroadcast', Number(calledNum));
                }

            }, 4000); 
        }
    }, 1000);
}

function endRoundAndRestart() {
    If (numberCallInterval) { clearInterval(numberCallInterval); numberCallInterval = null; }
    GlobalRoom.gameActive = false;
    GlobalRoom.calledNumbers = [];
    GlobalRoom.lastCalledNumber = null;
    GlobalRoom.playerRoundCards = {}; 
    GlobalRoom.gameStartTime = Date.now() + 60000;
    GlobalRoom.forcedWinningCardNums = [];
    
    Io.emit('roundEnded', { nextGameIn: 60000 });
    Io.emit('gameEndedBroadcast');
    RefreshTakenCardsList();
}

StartMainGameLoop();

Let telegramOffset = 0;
async function pollTelegramUpdates() {
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

                If (update.callback_query) {
                    Let callbackQuery = update.callback_query;
                    Let data = callbackQuery.data; 
                    Let chatId = callbackQuery.message.chat.id;
                    Let messageId = callbackQuery.message.message_id;
                    
                    Let parts = data.split('_');
                    Let action = parts[0]; 
                    Let requestId = parts.slice(1).join('_');
                    Let reqData = pendingRequests[requestId];

                    If (reqData) {
                        Let targetSocket = io.sockets.sockets.get(reqData.socketId);
                        If (action === 'app') {
                            If (targetSocket) {
                                Let finalAmountForClient = (reqData.type === 'withdraw' || reqData.type === 'withdrawal') ? -Math.abs(reqData.amount) : reqData.amount;
                                TargetSocket.emit('financialApproved', { type: reqData.type, amount: reqData.amount, adjustedAmount: finalAmountForClient });
                            }
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                Chat_id: chatId, message_id: messageId,
                                Text: `✅ *ጥያቄው ጸድቋል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            }).catch(() => {});
                        } else {
                            If (targetSocket) { 
                                TargetSocket.emit('financialRejected', { type: reqData.type, amount: reqData.amount }); 
                            }
                            Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                                Chat_id: chatId, message_id: messageId,
                                Text: `❌ *ጥያቄው ተሰርዟል!* (${reqData.amount} ብር - ${reqData.username})`, parse_mode: 'Markdown'
                            }).catch(() => {});
                        }
                        Delete pendingRequests[requestId]; 
                    }
                    Try { 
                        Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: callbackQuery.id }); 
                    } catch (e) {}
                }
            }
        }
    } catch (err) {}
    SetTimeout(pollTelegramUpdates, 1000);
}
setTimeout(pollTelegramUpdates, 2000);

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt) {
    If (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;
    Let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት' : '🏧 ቴሌብር ዊዝድሮዋል';
    Let message = `🔔 *AZ BINGO - ${reqTypeTitle}*\n\n👤 ስም: *${username || 'ተጫዋች'}*\n🆔 ዩዘር ID: \`${userId}\`\n💰 ቀሪ ሂሳብ: *${currentBalance} ብር*\n📥 የጠየቀው: *${amount} ብር*\n📱 ስልክ: ${phone || 'አልተሰጠም'}`;
    If (receipt) message += `\n\n📄 *ደረሰኝ / SMS:*\n\`${receipt}\``;
    Try {
        Await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            Chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown',
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

Let connectedRealPlayers = [];

Io.on('connection', (socket) => {
    ConnectedRealPlayers.push(socket.id);
    Let realCount = connectedRealPlayers.length;
    Let currentBotsCount = getRealisticBotsCount(realCount);
    GlobalRoom.playersCount = currentBotsCount + realCount; 
    Io.emit('updatePlayersCount', globalRoom.playersCount);
    Socket.emit('syncGameState', globalRoom);
    RefreshTakenCardsList();

    Socket.on('registerRealUser', (userData) => {
        If (userData && userData.userId) {
            Let userId = String(userData.userId);
            OnlineRealUsers = onlineRealUsers.filter(u => u.userId !== userId);
            OnlineRealUsers.push({ socketId: socket.id, userId: userId, username: userData.username || 'No Username', fullName: userData.fullName || 'ተጫዋች' });
        }
    });

    Socket.on('getAdminRealUsers', () => {
        Socket.emit('adminRealUsersListUpdate', onlineRealUsers);
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
                cards: data.cards,
                username: data.username || 'ተጫዋች',
                userId: data.userId || 'unknown'
            };
            If (globalRoom.playerTemporaryCards[socket.id]) {
                Delete globalRoom.playerTemporaryCards[socket.id];
            }
            RefreshTakenCardsList();
            Socket.emit('cardSelectionSuccess');
        }
    });

    Socket.on('adminSetNextWinner', (data) => {
        ForcedNextWinner = data.winnerType ? String(data.winnerType).trim() : null;
        Socket.emit('adminWinnerResponse', { success: true, message: `✅ ቀጣዩ አሸናፊ ተስተካክሏል` });
    });

    Socket.on('financialRequest', async (data) => {
        Data.type = data.type || 'deposit';
        Let { type, amount, username, userId, currentBalance, phone, receipt } = data;
        
        Let requestId = 'req_' + socket.id.substring(0, 5) + '_' + Math.floor(Math.random() * 1000000) + '_' + Date.now();
        
        PendingRequests[requestId] = { 
            UserId, 
            Type, 
            Amount, 
            Username, 
            SocketId: socket.id, 
            Timestamp: Date.now() 
        };

        Await sendAdminFinancialRequest(requestId, type, amount, username, userId, currentBalance, phone, receipt);
        Socket.emit('requestSubmitted', { success: true, message: "✅ ጥያቄዎ ለአድሚን ተልኳል!" });
    });

    Socket.on('disconnect', () => {
        ConnectedRealPlayers = connectedRealPlayers.filter(id => id !== socket.id);
        OnlineRealUsers = onlineRealUsers.filter(u => u.socketId !== socket.id);
        Delete globalRoom.playerRoundCards[socket.id];
        Delete globalRoom.playerTemporaryCards[socket.id];
        RefreshTakenCardsList();
        Let realCount = connectedRealPlayers.length;
        GlobalRoom.playersCount = getRealisticBotsCount(realCount) + realCount;
        Io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

Const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    Console.log("AZ Bingo Server running on port " + PORT);
});
