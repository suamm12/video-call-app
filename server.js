// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const users = {}; // ユーザーIDとソケットIDのマッピング

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
    console.log('A user connected:', socket.id);
    users[socket.id] = socket.id;

    // ユーザーがビデオ通話リクエストを送信
    socket.on('startVideoCall', (targetId) => {
        if (users[targetId]) {
            socket.emit('callStarted', targetId);
            io.to(targetId).emit('videoCallRequest', socket.id);
        } else {
            socket.emit('error', 'User not found');
        }
    });

    // ビデオ通話の応答
    socket.on('acceptVideoCall', (callerId) => {
        io.to(callerId).emit('callAccepted', socket.id);
    });

    // オファーの送信
    socket.on('offer', (offer) => {
        const { to } = offer;
        io.to(to).emit('offer', { offer: offer.offer, from: socket.id });
    });

    // アンサーの送信
    socket.on('answer', (answer) => {
        const { to } = answer;
        io.to(to).emit('answer', { answer: answer.answer, from: socket.id });
    });

    // ICE候補の送信
    socket.on('candidate', (candidate) => {
        const { to } = candidate;
        io.to(to).emit('candidate', { candidate: candidate.candidate, from: socket.id });
    });

    // チャットメッセージの送信
    socket.on('chatMessage', (message) => {
        const { to } = message;
        io.to(to).emit('chatMessage', { message: message.message, from: socket.id });
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete users[socket.id];
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
