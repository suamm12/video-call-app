const socket = io();
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleMicButton = document.getElementById('toggleMic');
const toggleCameraButton = document.getElementById('toggleCamera');

let localStream;
let peerConnection;
let micEnabled = false;
let cameraEnabled = true;

// WebRTCの設定
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// 初期設定で外向きカメラ、マイクをオフにしてセットアップ
navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.play();
        setupPeerConnection();
    })
    .catch(error => console.error('Error accessing media devices.', error));

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
});
