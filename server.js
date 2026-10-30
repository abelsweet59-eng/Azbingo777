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
    playersCount: 0
};

// 🟢 አድሚን ቦት ላይ "አጽድቅ" እና "ሰርዝ" አዝራሮችን (Inline Keyboard) በመላክ ማሳወቂያ መስጠት
async function sendAdminFinancialRequest(type, amount, username, userId, phone, receipt) {
    if (!TELEGRAM_BOT_TOKEN) return;
    
    let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት (ገንዘብ ማስገቢያ)' : '🏧 ቴሌብር ዊዝድሮዋል (ገንዘብ ማውጣት)';
    
    let message = `🔔 *AZ BINGO 777 - አዲስ የ${reqTypeTitle} ጥያቄ*\n\n` +
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
                        { text: "✅ አጽድቅ (Approve)", callback_data: `app_${type}_${userId}_${amount}` },
                        { text: "❌ ሰርዝ (Reject)", callback_data: `rej_${type}_${userId}_${amount}` }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error("Telegram admin notification error:", error);
    }
}

// 🟢 አድሚኑ በቴሌግራም ቦት ላይ አዝራሮቹን ሲጫን (Callback Query) የሚሰለፍበት Webhook/Polling endpoint
app.post(`/telegram-webhook`, async (req, res) => {
    const update = req.body;
    if (update && update.callback_query) {
        const callbackQuery = update.callback_query;
        const data = callbackQuery.data; // e.g., "app_deposit_371093083_100"
        const chatId = callbackQuery.message.chat.id;

        if (String(chatId) === String(ADMIN_CHAT_ID)) {
            const parts = data.split('_');
            const action = parts[0]; // 'app' or 'rej'
            const type = parts[1];   // 'deposit' or 'withdraw'
            const userId = parts[2];
            const amount = parts[3];

            if (action === 'app') {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: `✅ ጥያቄው ተቀባይነት አግኝቷል! የ ${amount} ብር የ ${type} ጥያቄ ጸድቋል።`
                });
                // Notify specific user via socket if connected
                io.emit('financialApproved', { userId, type, amount, message: `🎉 የእርስዎ የ ${amount} ብር የ ${type === 'deposit' ? 'ዲፖዚት' : 'ዊዝድሮዋል'} ጥያቄ በአድሚን ጸድቋል!` });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: `❌ ጥያቄው ተሰርዟል (Rejected)።`
                });
                io.emit('financialRejected', { userId, type, amount, message: `❌ የእርስዎ የ ${amount} ብር የ ${type === 'deposit' ? 'ዲፖዚት' : 'ዊዝድሮዋል'} ጥያቄ በአድሚን ተሰርዟል።` });
            }
        }
        // Answer callback query to stop loading on telegram button
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                callback_query_id: callbackQuery.id
            });
        } catch(e) {}
    }
    res.sendStatus(200);
});

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    globalRoom.playersCount++;
    io.emit('updatePlayersCount', globalRoom.playersCount);

    socket.emit('syncGameState', globalRoom);

    // 🟢 ከ 100 ብር በታች የሆኑ ጥያቄዎችን አግዶ፣ ለአድሚን ቦት በአዝራር መልክ መላክ
    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, phone, receipt } = data;
        
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ከ 100 ብር በታች ማዘዝ ወይም ማስገባት አይቻልም! ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }

        await sendAdminFinancialRequest(type, amount, username, userId, phone, receipt);
        socket.emit('requestSubmitted', { success: true, message: `የ ${amount} ብር ጥያቄዎ ለአድሚን ቴሌግራም ተልኳል! አድሚኑ ሲያጸድቀው አካውንትዎ ላይ ይስተካከላል።` });
    });

    socket.on('declareBingo', (data) => {
        let username = data && data.username ? data.username : 'ተጫዋች';
        io.emit('bingoWinner', { username, message: `🎉 BINGO WINNER! ተጫዋች ${username} ጨዋታውን አሸንፏል!` });
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        globalRoom.playersCount = Math.max(1, globalRoom.playersCount - 1);
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

setInterval(() => {
    let now = Date.now();
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
