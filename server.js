// server.js
const io = require('socket.io')(3000);

// 仮のユーザー情報管理（ここではメモリ内のオブジェクトを使用）
const users = {};
const userKeywords = {}; // ユーザーIDとキーワードのマッピング

io.on('connection', socket => {
    console.log('A user connected:', socket.id);

    // ユーザーの情報を登録
    users[socket.id] = { id: socket.id, keyword: '' };
    userKeywords[socket.id] = ''; // 初期キーワード

    // ユーザーがキーワードを設定
    socket.on('setKeyword', keyword => {
        userKeywords[socket.id] = keyword;
        console.log(`User ${socket.id} set keyword to "${keyword}"`);
    });

    // 検索リクエストの処理
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
        delete users[socket.id];
        delete userKeywords[socket.id];
    });
});

console.log('Server listening on port 3000');
