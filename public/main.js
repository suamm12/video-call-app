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
const searchStatus = document.getElementById('searchStatus'); // ローディング表示用

let localStream;
let peerConnection;
let micEnabled = true;
let cameraEnabled = true;
let otherUserId = null;
let chatRoom = null;

// WebRTCの設定
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // STUNサーバーの設定
    ]
};

// 初期設定で外向きカメラ、マイクをオンにしてセットアップ
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
        localVideo.srcObject = localStream;
        localVideo.play();
        setupPeerConnection();
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

// PeerConnectionのセットアップ
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    // ローカルストリームをPeerConnectionに追加
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // ICE候補を送信
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };

    // リモートストリームを受信
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Offerの受信とAnswerの処理
    socket.on('offer', async offer => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', answer);
    });

    socket.on('answer', async answer => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', candidate => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    // ビデオ通話のリクエストを受信
    socket.on('startVideoCall', (callerId) => {
        if (confirm('Incoming video call request. Accept?')) {
            otherUserId = callerId;
            socket.emit('acceptVideoCall', callerId);
        }
    });

    socket.on('callAccepted', (calleeId) => {
        otherUserId = calleeId;
        chatRoom = `${socket.id}-${otherUserId}`;
        socket.emit('joinRoom', chatRoom);
        makeCall();
    });

    // チャットメッセージの受信
    socket.on('chatMessage', (message) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;  // スクロールを最新メッセージに合わせる
    });

    // 検索結果を受信
    socket.on('searchResult', (userIds) => {
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

// マイクのオン・オフを切り替える関数
toggleMicButton.addEventListener('click', () => {
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    toggleMicButton.textContent = micEnabled ? 'マイクオフ' : 'マイクオン';
});

// カメラの切り替え（外向き・内向き）を切り替える関数
toggleCameraButton.addEventListener('click', async () => {
    cameraEnabled = !cameraEnabled;
    const videoConstraints = cameraEnabled ? { facingMode: "environment" } : { facingMode: "user" };

    // 現在のビデオストリームを停止
    localStream.getVideoTracks().forEach(track => track.stop());

    // 新しいビデオストリームを取得
    try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: micEnabled, video: videoConstraints });
        localStream = newStream;
        localVideo.srcObject = localStream;

        // PeerConnectionに新しいストリームを追加
        peerConnection.getSenders().forEach(sender => {
            if (sender.track.kind === 'video') {
                peerConnection.removeTrack(sender);
                peerConnection.addTrack(newStream.getVideoTracks()[0], localStream);
            }
        });

        localVideo.play();
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
});

// チャット機能
sendMessageButton.addEventListener('click', () => {
    const message = messageInput.value;
    if (message && chatRoom) {
        socket.emit('chatMessage', message);
        messageInput.value = '';
    } else {
        alert('You need to be in a chat room to send messages.');
    }
});

// ユーザー検索機能
searchUsersButton.addEventListener('click', () => {
    const keyword = keywordInput.value;
    if (keyword) {
        searchStatus.textContent = 'Searching...'; // ローディング表示
        socket.emit('startVideoCall', keyword);
    }
});

// ページのロード時にメディアを開始
window.onload = startMedia;
