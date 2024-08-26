const socket = io();

let localStream;
let peerConnection;
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = localStream;
    })
    .catch(error => console.error('Error accessing media devices.', error));

startCallButton.addEventListener('click', startCall);

socket.on('offer', (offer) => {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
    peerConnection.addStream(localStream);
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => socket.emit('answer', peerConnection.localDescription))
        .catch(error => console.error('Error during offer handling.', error));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };
});

socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

function startCall() {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
    peerConnection.addStream(localStream);
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => socket.emit('offer', peerConnection.localDescription))
        .catch(error => console.error('Error during offer creation.', error));

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };
}
