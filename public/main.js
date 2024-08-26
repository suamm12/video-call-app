// public/main.js
const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleMicButton = document.getElementById('toggleMic');
const toggleCameraButton = document.getElementById('toggleCamera');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');
const chatBox = document.getElementById('chatBox');
const keywordInput = document.getElementById('keywordInput');
const searchUsersButton = document.getElementById('searchUsers');
const searchStatus = document.getElementById('searchStatus');

let localStream;
let peerConnection;
let micEnabled = true;
let cameraEnabled = true;
let otherUserId = null;
let chatRoom = null;

// WebRTCの設定
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // STUNサーバー
    ]
};

// メディアストリームの取得と設定
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: "environment" } // デフォルトで外向きカメラ
        });
        localVideo.srcObject = localStream;
        localVideo.play();
        setupPeerConnection();
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

// PeerConnectionの設定
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    // ローカルストリームのトラックをPeerConnectionに追加
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // ICE候補を送信
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, to: otherUserId });
        }
    };

    // リモートストリームの受信
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // サーバーからのオファーの処理
    socket.on('offer', async ({ offer, from }) => {
        otherUserId = from;
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer, to: from });
    });

    // サーバーからのアンサーの処理
    socket.on('answer', async ({ answer, from }) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // サーバーからのICE候補の処理
    socket.on('candidate', ({ candidate, from }) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // ビデオ通話リクエストの受信
    socket.on('startVideoCall', async (callerId) => {
        if (confirm('Incoming video call request. Accept?')) {
            otherUserId = callerId;
            socket.emit('acceptVideoCall', otherUserId);
            await startMedia();
        }
    });

    // ビデオ通話の応答
    socket.on('callAccepted', async (calleeId) => {
        otherUserId = calleeId;
        await startMedia();
    });

    // チャットメッセージの受信
    socket.on('chatMessage', (message) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
    });
}

// マイクのオン・オフ切り替え
toggleMicButton.addEventListener('click', () => {
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = micEnabled;
    });
    toggleMicButton.textContent = micEnabled ? 'マイクオフ' : 'マイクオン';
});

// カメラのオン・オフ切り替え
toggleCameraButton.addEventListener('click', () => {
    cameraEnabled = !cameraEnabled;
    localStream.getVideoTracks().forEach(track => {
        track.enabled = cameraEnabled;
    });
    toggleCameraButton.textContent = cameraEnabled ? '内向きカメラ' : '外向きカメラ';
});

// メッセージ送信
sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message && chatRoom) {
        socket.emit('chatMessage', message);
        const messageElement = document.createElement('div');
        messageElement.textContent = `You: ${message}`;
        chatBox.appendChild(messageElement);
        messageInput.value = '';
    }
});

// ユーザー検索
searchUsersButton.addEventListener('click', () => {
    const keyword = keywordInput.value;
    if (keyword) {
        searchStatus.textContent = 'Searching...';
        socket.emit('searchUsers', keyword);
    }
});

// 検索結果の表示
socket.on('searchResult', (users) => {
    searchStatus.textContent = '';
    if (users.length > 0) {
        searchStatus.textContent = `Found ${users.length} user(s)`;
        users.forEach(userId => {
            const userElement = document.createElement('div');
            userElement.textContent = `User ID: ${userId}`;
            userElement.addEventListener('click', () => {
                socket.emit('startVideoCall', keywordInput.value);
            });
            searchStatus.appendChild(userElement);
        });
    } else {
        searchStatus.textContent = 'No users found';
    }
});

// 初期化
startMedia();
