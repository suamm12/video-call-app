const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const userKeywords = {};
const connectedUsers = {};
const userCalls = {};

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
        const { recipientId } = message;
        if (userCalls[socket.id] && userCalls[socket.id].includes(recipientId)) {
            if (connectedUsers[recipientId]) {
                connectedUsers[recipientId].emit('chatMessage', message);
            }
        }
    });

    // ビデオ通話のシグナリングメッセージを中継
    socket.on('offer', (offer) => {
        socket.broadcast.emit('offer', offer);
        userCalls[socket.id] = [socket.id]; // Initialize call list for the user
    });

    socket.on('answer', (answer) => {
        socket.broadcast.emit('answer', answer);
        const callerId = Object.keys(userCalls).find(id => userCalls[id].includes(socket.id));
        if (callerId) {
            userCalls[callerId].push(socket.id);
        }
    });

    socket.on('candidate', (candidate) => {
        socket.broadcast.emit('candidate', candidate);
    });

    socket.on('startVideoCall', (keyword) => {
        const targetUserIds = Object.keys(userKeywords).filter(id => userKeywords[id] === keyword);
        targetUserIds.forEach(id => {
            if (connectedUsers[id]) {
                connectedUsers[id].emit('startVideoCall', socket.id);
            }
        });
    });

    socket.on('acceptVideoCall', (callerId) => {
        if (connectedUsers[callerId]) {
            connectedUsers[callerId].emit('callAccepted', socket.id);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        delete userKeywords[socket.id];
        delete connectedUsers[socket.id];
        Object.keys(userCalls).forEach(id => {
            userCalls[id] = userCalls[id].filter(calleeId => calleeId !== socket.id);
            if (userCalls[id].length === 0) {
                delete userCalls[id];
            }
        });
    });
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
