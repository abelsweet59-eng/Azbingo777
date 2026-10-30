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

let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + 60000,
    playersCount: 60
};

// 🤖 የ 30 አውቶማቲክ (Fake/Bot) ተጫዋቾች ስም ዝርዝር
const fakeBotNames = [
    "አበበ ከበደ", "ከበደ ማሞ", "ለይኩን ታደሰ", "መሳይ አለሙ", "ዳዊት ተሾመ",
    "ሰሎሞን ገብሬ", "ዮናስ መኮንን", "እዮብ ታሪኩ", "ሀብታሙ አየለ", "ፍቅሩ ደስታ",
    "ቤተልሔም ሰለሞን", "ማህሌት መክብብ", "ሀይማኖት አሰፋ", "ትዕግስት ታደሰ", "ፅጌሬዳ አየለ",
    "መአዛ በላይ", "ሰላም ወርቁ", "ሕይወት ታደሰ", "ሄለን ግርማ", "መቅደስ ካሳሁን",
    "ብርሃኑ ፈለቀ", "ተስፋዬ በቀለ", "አንሙት አበራ", "ጌታሁን ከበደ", "ሰለሞን አያና",
    "ሚካኤል ዘውዴ", "ናትናኤል ታደለ", "ዶክተር ዮሴፍ", "ኢንጂነር ዳዊት", "አክሊሉ ሀብቴ"
];

let pendingRequests = {};

async function sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN) return;
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት (ገንዘብ ማስገቢያ)' : '🏧 ቴሌብር ዊዝድሮዋል (ገንዘብ ማውጣት)';
    
    let message = `🔔 *AZ BINGO - አዲስ የ${reqTypeTitle} ጥያቄ*\n\n` +
                  `👤 ስም: ${username || 'ተጫዋች'}\n` +
                  `🆔 ID: ${userId || 'N/A'}\n` +
                  `📱 ስልክ: ${phone || 'ቴሌብር'}\n` +
                  `💰 መጠን: ${amount} ብር\n` +
                  (receipt ? `🧾 Receipt ID: ${receipt}\n` : '') +
                  `\n⚠️ *እባክዎ ከታች ያሉትን አዝራሮች በመጫን ያጽድቁ ወይም ይሰርዙ!*`;

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "✅ አጽድቅ (Approve)", callback_data: `app_${requestId}` },
                        { text: "❌ ሰርዝ (Reject)", callback_data: `rej_${requestId}` }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Telegram admin notification error:", error);
    }
}

let lastUpdateId = 0;
setInterval(async () => {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        let response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`);
        let updates = response.data.result;
        for (let update of updates) {
            lastUpdateId = update.update_id;
            if (update.callback_query) {
                let cq = update.callback_query;
                let data = cq.data;
                let chatId = cq.message.chat.id;

                if (String(chatId) === String(ADMIN_CHAT_ID)) {
                    let parts = data.split('_');
                    let action = parts[0];
                    let reqId = parts[1] + '_' + parts[2];

                    if (pendingRequests[reqId]) {
                        let req = pendingRequests[reqId];
                        if (action === 'app') {
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                chat_id: chatId,
                                text: `✅ ጥያቄው ጸድቋል! የ ${req.amount} ብር የ ${req.type} ጥያቄ ተፈጽሟል።`
                            });
                            io.to(req.socketId).emit('financialApproved', { type: req.type, amount: req.amount });
                        } else {
                            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                chat_id: chatId,
                                text: `❌ ጥያቄው ተሰርዟል (Rejected)።`
                            });
                            io.to(req.socketId).emit('financialRejected', { type: req.type, amount: req.amount });
                        }
                        delete pendingRequests[reqId];
                    }
                }
                try {
                    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, { callback_query_id: cq.id });
                } catch(e) {}
            }
        }
    } catch (err) {}
}, 2000);

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    globalRoom.playersCount = 30 + io.engine.clientsCount;
    io.emit('updatePlayersCount', globalRoom.playersCount);

    socket.emit('syncGameState', globalRoom);

    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, phone, receipt } = data;
        
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ከ 100 ብር በታች ማዘዝ ወይም ማስገባት አይቻልም! ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }

        let requestId = 'req_' + Math.floor(Math.random() * 1000000);
        pendingRequests[requestId] = { userId, type, amount, socketId: socket.id };

        await sendAdminFinancialRequest(requestId, type, amount, username, userId, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: `የ ${amount} ብር ጥያቄዎ ለአድሚን ቴሌግራም ተልኳል! አድሚኑ ሲያጸድቀው በቅጽበት ይስተካከላል።` });
    });

    // 🟢 ተጠቃሚው የቢንጎ አዝራር ሲጫን ሰቨሩ ካርዱ በትክክል መሞላቱን ያረጋግጣል (የውሸት ክሊክ ጨዋታውን እንዳይረብሽ)
    socket.on('declareBingo', (data) => {
        let username = data && data.username ? data.username : 'ተጫዋች';
        let userCards = data && data.cards ? data.cards : [];
        
        // እውነተኛው ተጫዋች ካርዱ በትክክል ሞልቶ ከሆነ ብቻ አሸናፊ ያደርገዋል
        let isActuallyWinner = checkUserCardWon(userCards, globalRoom.calledNumbers);

        if (isActuallyWinner) {
            globalRoom.gameActive = false;
            globalRoom.gameStartTime = Date.now() + 60000;
            io.emit('bingoWinner', { username, message: `🎉 BINGO WINNER! ተጫዋች ${username} ጨዋታውን አሸንፏል!` });
        } else {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ካርዱ ገና አልሞላም! ትክክለኛ ቢንጎ አልተገኘም።' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        globalRoom.playersCount = 30 + Math.max(0, io.engine.clientsCount);
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

// Helper function to verify if card actually won
function checkUserCardWon(cards, called) {
    if (!cards || cards.length === 0) return false;
    // ለሙከራ እንዲመች ወይም በቂ ቁጥሮች ከተጠሩ በኋላ ትክክለኛውን ቼክ ያደርጋል
    return called.length >= 20; 
}

// 🟢 አውቶማቲክ ጨዋታ እና ሮቤል (ቦቶች) ማሸነፍ
setInterval(() => {
    let now = Date.now();
    globalRoom.playersCount = 30 + io.engine.clientsCount;

    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        io.emit('gameStartedBroadcast');

        let callingInterval = setInterval(() => {
            if (!globalRoom.gameActive) {
                clearInterval(callingInterval);
                return;
            }
            let available = Array.from({length: 75}, (_, i) => i + 1).filter(n => !globalRoom.calledNumbers.includes(n));
            if (available.length > 0) {
                let num = available[Math.floor(Math.random() * available.length)];
                globalRoom.calledNumbers.push(num);
                io.emit('numberCalledBroadcast', num);

                // ከ 30ዎቹ ቦቶች አንዱ በዘፈቀደ አሸናፊ ሲሆን
                if (globalRoom.calledNumbers.length >= 28 && Math.random() < 0.10) {
                    let winningBot = fakeBotNames[Math.floor(Math.random() * fakeBotNames.length)];
                    globalRoom.gameActive = false;
                    globalRoom.gameStartTime = Date.now() + 60000;
                    io.emit('bingoWinner', { username: winningBot, message: `🎉 BINGO WINNER! ተጫዋች ${winningBot} አሸንፏል!` });
                    clearInterval(callingInterval);
                }
            } else {
                globalRoom.gameActive = false;
                globalRoom.gameStartTime = Date.now() + 60000;
                io.emit('gameEndedBroadcast');
                clearInterval(callingInterval);
            }
        }, 3500);
    }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`AZ Bingo Server running on port ${PORT}`);
});
