const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// ユーザーのキーワードを保存するためのシンプルなストレージ
const userKeywords = {};

// 接続されたユーザーを管理
const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    // ユーザーがキーワードを設定する
    socket.on('setKeywords', (keywords) => {
        userKeywords[socket.id] = keywords;
        connectedUsers[socket.id] = socket;
        console.log(`User ${socket.id} set keywords: ${keywords}`);
    });

    // メッセージのブロードキャスト
    socket.on('chatMessage', (message) => {
        if (connectedUsers[socket.id]) {
            io.to(connectedUsers[socket.id].room).emit('chatMessage', message);
        }
    });

    // ビデオ通話のシグナリングメッセージを中継
    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
    });

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
    });

    socket.on('candidate', (candidate) => {
        socket.broadcast.emit('candidate', candidate);
    });

    // ユーザーのディスコネクト処理
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        delete userKeywords[socket.id];
        delete connectedUsers[socket.id];
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

    // ユーザーのチャットルーム設定
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room ${room}`);
    });

    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`User ${socket.id} left room ${room}`);
    });

    socket.on('acceptVideoCall', (callerId) => {
        if (connectedUsers[callerId]) {
            connectedUsers[callerId].emit('callAccepted', socket.id);
            socket.emit('callAccepted', callerId);
        }
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
