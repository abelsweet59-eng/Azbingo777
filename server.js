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

async function sendAdminNotification(message) {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        });
    } catch (error) {
        console.error("Telegram notification error:", error);
    }
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    globalRoom.playersCount++;
    io.emit('updatePlayersCount', globalRoom.playersCount);

    socket.emit('syncGameState', globalRoom);

    // Financial requests with strict backend validation
    socket.on('financialRequest', async (data) => {
        if (!data) return;
        let { type, amount, username, userId, phone, receipt } = data;
        
        if (!amount || amount < 100) {
            socket.emit('requestSubmitted', { success: false, message: '⚠️ ከ 100 ብር በታች ማዘዝ ወይም ማስገባት አይቻልም! ዝቅተኛው ገደብ 100 ብር ነው።' });
            return;
        }

        let reqTypeTitle = type === 'deposit' ? '💳 ቴሌብር ዲፖዚት (ገንዘብ ማስገቢያ)' : '🏧 ቴሌብር ዊዝድሮዋል (ገንዘብ ማውጣት)';
        
        let msg = `🔔 *AZ BINGO 777 - አዲስ የ${reqTypeTitle} ጥያቄ*\n\n` +
                  `👤 ስም: ${username || 'ተጫዋች'}\n` +
                  `🆔 ID: ${userId || 'N/A'}\n` +
                  `📱 ስልክ: ${phone || 'ቴሌብር'}\n` +
                  `💰 መጠን: ${amount} ብር\n` +
                  (receipt ? `🧾 Receipt ID: ${receipt}\n` : '') +
                  `\n⚠️ *ማስታወሻ:* አድሚን እስኪያረጋግጥ ይጠብቁ!`;

        await sendAdminNotification(msg);
        socket.emit('requestSubmitted', { success: true, message: `የ ${amount} ብር ጥያቄዎ ለአድሚን ቴሌግራም ተልኳል!` });
    });

    socket.on('declareBingo', (data) => {
        let username = data && data.username ? data.username : 'ተጫዋች';
        io.emit('bingoWinner', `🎉 BINGO WINNER! ተጫዋች ${username} አሸንፏል!`);
        sendAdminNotification(`🏆 *BINGO WINNER ALERT!*\n\nተጫዋች *${username}* ጨዋታውን አሸንፏል!`);
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
