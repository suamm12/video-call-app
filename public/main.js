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
            socket.emit('candidate', event.candidate);
        }
    };

    // リモートストリームの受信
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // サーバーからのオファーの処理
    socket.on('offer', async offer => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer);
    });

    // サーバーからのアンサーの処理
    socket.on('answer', async answer => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    // サーバーからのICE候補の処理
    socket.on('candidate', candidate => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // ビデオ通話リクエストの受信
    socket.on('startVideoCall', callerId => {
        if (confirm('Incoming video call request. Accept?')) {
            otherUserId = callerId;
            socket.emit('acceptVideoCall', callerId);
        }
    });

    // 通話が受け入れられたときの処理
    socket.on('callAccepted', calleeId => {
        otherUserId = calleeId;
        chatRoom = `${socket.id}-${otherUserId}`;
        socket.emit('joinRoom', chatRoom);
        makeCall();
    });

    // チャットメッセージの受信
    socket.on('chatMessage', message => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // 最新メッセージにスクロール
    });

    // 検索結果の受信
    socket.on('searchResult', userIds => {
        searchStatus.textContent = '';
        if (userIds.length > 0) {
            alert(`Users found: ${userIds.join(', ')}`);
            otherUserId = userIds[0];
            chatRoom = `${socket.id}-${otherUserId}`;
        } else {
            alert('No users found');
        }
    });
}

// ビデオ通話を開始するための関数
async function makeCall() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', offer);
}

// マイクのオン・オフを切り替える
toggleMicButton.addEventListener('click', () => {
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    toggleMicButton.textContent = micEnabled ? 'マイクオフ' : 'マイクオン';
});

// カメラの切り替え
toggleCameraButton.addEventListener('click', async () => {
    cameraEnabled = !cameraEnabled;
    const videoConstraints = cameraEnabled ? { facingMode: "environment" } : { facingMode: "user" };
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    localStream.getVideoTracks().forEach(track => track.stop());
    localStream.addTrack(stream.getVideoTracks()[0]);
    localVideo.srcObject = localStream;
    localVideo.play();
    toggleCameraButton.textContent = cameraEnabled ? '内向きカメラ' : '外向きカメラ';
});

// メッセージ送信
sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message && chatRoom) {
        socket.emit('chatMessage', message);
        messageInput.value = '';
    }
});

// ユーザー検索
searchUsersButton.addEventListener('click', () => {
    const keyword = keywordInput.value;
    if (keyword) {
        searchStatus.textContent = '検索中...'; // ローディング表示
        socket.emit('startVideoCall', keyword);
    }
});

// 初期化
startMedia();
