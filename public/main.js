let localStream;
let micEnabled = false;
let cameraEnabled = false;
const localVideo = document.getElementById('localVideo');
const toggleMicButton = document.getElementById('toggleMic');
const toggleCameraButton = document.getElementById('toggleCamera');

// 初期設定で外向きカメラ、マイクをオフにしてセットアップ
navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
        localVideo.play();
        micEnabled = false; // 初期状態でマイクをオフ
        cameraEnabled = true; // 外向きカメラがデフォルト
        toggleMicButton.textContent = 'マイクオン'; // ボタンのテキストを設定
    })
    .catch(error => console.error('Error accessing media devices.', error));

// マイクのオン・オフを切り替える関数
toggleMicButton.addEventListener('click', () => {
    micEnabled = !micEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    toggleMicButton.textContent = micEnabled ? 'マイクオフ' : 'マイクオン';
});

// カメラの切り替え（外向き・内向き）を切り替える関数
toggleCameraButton.addEventListener('click', () => {
    if (cameraEnabled) {
        // 外向きカメラから内向きカメラに切り替え
        localStream.getVideoTracks().forEach(track => track.stop());
        navigator.mediaDevices.getUserMedia({ audio: micEnabled, video: { facingMode: "user" } })
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = localStream;
                localVideo.play();
                cameraEnabled = false;
            })
            .catch(error => console.error('Error accessing media devices.', error));
    } else {
        // 内向きカメラから外向きカメラに切り替え
        localStream.getVideoTracks().forEach(track => track.stop());
        navigator.mediaDevices.getUserMedia({ audio: micEnabled, video: { facingMode: "environment" } })
            .then(stream => {
                localStream = stream;
                localVideo.srcObject = localStream;
                localVideo.play();
                cameraEnabled = true;
            })
            .catch(error => console.error('Error accessing media devices.', error));
    }
});
