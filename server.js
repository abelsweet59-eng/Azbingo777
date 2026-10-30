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

// Global Game State for all players in Room 101
let globalRoom = {
    gameActive: false,
    calledNumbers: [],
    gameStartTime: Date.now() + 60000, // Next game countdown
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

    // Send current game state immediately to newly joined user
    socket.emit('syncGameState', globalRoom);

    socket.on('financialRequest', async ({ type, amount, username, userId, phone, receipt }) => {
        let msg = `🔔 *AZ BINGO 777 - አዲስ የ${type === 'deposit' ? 'ዲፖዚት' : 'ዊዝድሮዋል'} ጥያቄ*\n\n` +
                  `👤 ስም: ${username}\n` +
                  `🆔 ID: ${userId}\n` +
                  `📱 ስልክ/ቴሌብር: ${phone}\n` +
                  `💰 መጠን: ${amount} ብር\n` +
                  (receipt ? `🧾 receipt ID: ${receipt}` : '');

        await sendAdminNotification(msg);
        socket.emit('requestSubmitted', { success: true, message: `የ ${amount} ብር ጥያቄዎ ለአድሚን ተልኳል!` });
    });

    socket.on('declareBingo', ({ username }) => {
        io.emit('bingoWinner', `🎉 BINGO WINNER! ተጫዋች ${username} አሸንፏል!`);
        sendAdminNotification(`🏆 *BINGO WINNER ALERT!*\n\nተጫዋች *${username}* ጨዋታውን አሸንፏል!`);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        globalRoom.playersCount = Math.max(1, globalRoom.playersCount - 1);
        io.emit('updatePlayersCount', globalRoom.playersCount);
    });
});

// Server-side game loop keeping everyone synchronized
setInterval(() => {
    let now = Date.now();
    if (!globalRoom.gameActive && now >= globalRoom.gameStartTime) {
        globalRoom.gameActive = true;
        globalRoom.calledNumbers = [];
        io.emit('gameStartedBroadcast');

        // Call numbers every 3.5 seconds
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
                globalRoom.gameStartTime = Date.now() + 60000; // Next round in 60s
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
