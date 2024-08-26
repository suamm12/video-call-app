// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// クライアントサイドの静的ファイルを提供
app.use(express.static(path.join(__dirname, 'public')));

// 仮のユーザー情報管理
const userKeywords = {}; // ユーザーIDとキーワードのマッピング

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    // ユーザーのキーワードを設定
    socket.on('setKeyword', keyword => {
        userKeywords[socket.id] = keyword;
        console.log(`User ${socket.id} set keyword to "${keyword}"`);
    });

    // ユーザー検索リクエストの処理
    socket.on('searchUsers', keyword => {
        console.log('Search keyword:', keyword);
        const matchingUsers = Object.keys(userKeywords)
            .filter(userId => userKeywords[userId] === keyword && userId !== socket.id);
        socket.emit('searchResult', matchingUsers);
    });

    // ビデオ通話オファーの処理
    socket.on('offer', (offer) => {
        const { to } = offer;
        io.to(to).emit('offer', { offer: offer.offer, from: socket.id });
    });

    // ビデオ通話アンサーの処理
    socket.on('answer', (answer) => {
        const { to } = answer;
        io.to(to).emit('answer', { answer: answer.answer, from: socket.id });
    });

    // ICE候補の処理
    socket.on('candidate', (candidate) => {
        const { to } = candidate;
        io.to(to).emit('candidate', { candidate: candidate.candidate, from: socket.id });
    });

    // チャットメッセージの送信
    socket.on('chatMessage', (message) => {
        if (socket.chatRoom) {
            io.to(socket.chatRoom).emit('chatMessage', message);
        }
    });

    // ビデオ通話のリクエストを送信
    socket.on('startVideoCall', (keyword) => {
        const matchingUsers = Object.keys(userKeywords)
            .find(userId => userKeywords[userId] === keyword && userId !== socket.id);

        if (matchingUsers) {
            socket.emit('searchResult', [matchingUsers]);
            io.to(matchingUsers).emit('startVideoCall', socket.id);
        } else {
            socket.emit('searchResult', []);
        }
    });

    // ビデオ通話の応答
    socket.on('acceptVideoCall', (callerId) => {
        socket.chatRoom = `${socket.id}-${callerId}`;
        io.to(callerId).emit('callAccepted', socket.id);
    });

    // 接続終了時の処理
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete userKeywords[socket.id];
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
