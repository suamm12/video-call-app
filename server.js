// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

let userKeywords = {};
let connectedUsers = {};

// クライアントが接続したとき
io.on('connection', (socket) => {
    console.log('A user connected');

    // ユーザーがキーワードを設定する
    socket.on('setKeywords', (keywords) => {
        userKeywords[socket.id] = keywords;
        connectedUsers[socket.id] = socket;
        console.log(`User ${socket.id} set keywords: ${keywords}`);
    });

    // 検索ワードに基づいてビデオ通話を開始するためのリクエスト
    socket.on('startVideoCall', (keyword) => {
        const targetUserIds = Object.keys(userKeywords).filter(id => userKeywords[id] === keyword);
        if (targetUserIds.length > 0) {
            socket.emit('searchResult', targetUserIds);
        } else {
            socket.emit('searchResult', []);
        }
    });

    // チャットメッセージを受信し、他のクライアントに送信
    socket.on('chatMessage', (message) => {
        if (socket.chatRoom) {
            io.to(socket.chatRoom).emit('chatMessage', message);
        }
    });

    // ビデオ通話のオファーを送信
    socket.on('offer', (offer) => {
        if (socket.chatRoom) {
            socket.to(socket.chatRoom).emit('offer', offer);
        }
    });

    // ビデオ通話のアンサーを送信
    socket.on('answer', (answer) => {
        if (socket.chatRoom) {
            socket.to(socket.chatRoom).emit('answer', answer);
        }
    });

    // ICE候補を送信
    socket.on('candidate', (candidate) => {
        if (socket.chatRoom) {
            socket.to(socket.chatRoom).emit('candidate', candidate);
        }
    });

    // ビデオ通話リクエストの受け入れ
    socket.on('acceptVideoCall', (callerId) => {
        const callerSocket = connectedUsers[callerId];
        if (callerSocket) {
            callerSocket.emit('callAccepted', socket.id);
            socket.chatRoom = `${socket.id}-${callerId}`;
            callerSocket.chatRoom = `${socket.id}-${callerId}`;
            socket.join(socket.chatRoom);
            callerSocket.join(socket.chatRoom);
        }
    });

    // ユーザーが切断したとき
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        delete userKeywords[socket.id];
        delete connectedUsers[socket.id];
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
