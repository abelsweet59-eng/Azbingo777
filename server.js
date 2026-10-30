const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public')); // Frontend ፋይሎችን ለማስተናገድ

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let gameTimer = 60;
let isGameActive = false;
let calledNumbers = [];
let uncalledNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let activePlayers = {}; // የተጫዋቾች ዝርዝር

// በየሰከንዱ የሚሄድ ማዕከላዊ ሰዓት (Synced Global Loop)
setInterval(() => {
    if (!isGameActive) {
        gameTimer--;
        if (gameTimer <= 0) {
            startGame();
        }
        io.emit('timerUpdate', { timer: gameTimer });
    }
}, 1000);

function startGame() {
    isGameActive = true;
    calledNumbers = [];
    uncalledNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    io.emit('gameStarted');

    // በየ 3.5 ሰከንዱ ቁጥር መጥራት
    const callInterval = setInterval(() => {
        if (uncalledNumbers.length > 0 && isGameActive) {
            const randIdx = Math.floor(Math.random() * uncalledNumbers.length);
            const num = uncalledNumbers.splice(randIdx, 1)[0];
            calledNumbers.push(num);

            // ከ 60 ተጫዋች በታች ሲሆን በ 22ኛው ቁጥር ላይ አውቶማቲክ የቦት አሸናፊነት ማሳወቅ
            const playerCount = Object.keys(activePlayers).length;
            if (playerCount < 60 && calledNumbers.length >= 22) {
                clearInterval(callInterval);
                isGameActive = false;
                gameTimer = 60;
                const botNames = ["ገብረመድህን", "አለማየሁ", "ተስፋዬ", "ደረጀ", "መላኩ", "አሰፋ"];
                const winBot = botNames[Math.floor(Math.random() * botNames.length)];
                io.emit('gameWinner', { winnerName: winBot, payout: (playerCount * 10) * 0.7 });
                return;
            }

            io.emit('numberCalled', { number: num, calledNumbers });
        } else {
            clearInterval(callInterval);
            isGameActive = false;
            gameTimer = 60;
        }
    }, 3500);
}

io.on('connection', (socket) => {
    socket.on('joinGame', (userData) => {
        activePlayers[socket.id] = userData;
        io.emit('playerCountUpdate', { count: Math.max(30, Object.keys(activePlayers).length) });
    });

    socket.on('disconnect', () => {
        delete activePlayers[socket.id];
        io.emit('playerCountUpdate', { count: Math.max(30, Object.keys(activePlayers).length) });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AZ Bingo Server running on port ${PORT}`));
