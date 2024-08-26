// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const userKeywords = {}; // ユーザーIDとキーワードのマッピング
const pendingCalls = {}; // 保留中の通話リクエスト

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    // ユーザーがキーワードを設定
    socket.on('setKeyword', keyword => {
        userKeywords[socket.id] = keyword;
        console.log(`User ${socket.id} set keyword to "${keyword}"`);
    });

    // ユーザー検索
    socket.on('searchUsers', keyword => {
        console.log('Search keyword:', keyword);
        const matchingUsers = Object.keys(userKeywords)
            .filter(userId => userKeywords[userId] === keyword && userId !== socket.id);
        socket.emit('searchResult', matchingUsers);
    });

    // ビデオ通話オファーの送信
    socket.on('startVideoCall', (keyword) => {
        const matchingUsers = Object.keys(userKeywords)
            .find(userId => userKeywords[userId] === keyword && userId !== socket.id);

        if (matchingUsers) {
            // 既存の通話リクエストをキャンセル
            if (pendingCalls[socket.id]) {
                io.to(pendingCalls[socket.id]).emit('callCanceled');
                delete pendingCalls[socket.id];
            }

            pendingCalls[socket.id] = matchingUsers;
            socket.emit('searchResult', [matchingUsers]);
            io.to(matchingUsers).emit('startVideoCall', socket.id);
        } else {
            socket.emit('searchResult', []);
        }
    });

    // ビデオ通話リクエストの受信
    socket.on('acceptVideoCall', (callerId) => {
        if (pendingCalls[callerId]) {
            socket.chatRoom = `${callerId}-${socket.id}`;
            io.to(callerId).emit('callAccepted', socket.id);
            delete pendingCalls[callerId];
        }
    });

    // ビデオ通話のオファー
    socket.on('offer', (offer) => {
        const { to } = offer;
        io.to(to).emit('offer', { offer: offer.offer, from: socket.id });
    });

    // アンサーの処理
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
        if (socket.chatRoom) {
            io.to(socket.chatRoom).emit('chatMessage', message);
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete userKeywords[socket.id];
        if (pendingCalls[socket.id]) {
            io.to(pendingCalls[socket.id]).emit('callCanceled');
            delete pendingCalls[socket.id];
        }
    });
});

server.listen(3000, () => {
    console.log('Server listening on port 3000');
});
