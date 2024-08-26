const socket = io();

let localStream;
let peerConnection;
let micEnabled = false;
const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const micToggleButton = document.getElementById('micToggle');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

async function getDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    return videoDevices;
}

async function startStream() {
    const videoDevices = await getDevices();
    const videoDeviceId = videoDevices.length > 1 ? videoDevices[1].deviceId : videoDevices[0].deviceId;

    const constraints = {
        video: { deviceId: videoDeviceId },
        audio: { audio: micEnabled }
    };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Error accessing media devices.', error);
    }
}

async function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };
    peerConnection.addStream(localStream);
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };
}

socket.on('offer', async (offer) => {
    await setupPeerConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => socket.emit('answer', peerConnection.localDescription))
        .catch(error => console.error('Error during offer handling.', error));
});

socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

function startCall() {
    setupPeerConnection()
        .then(() => peerConnection.createOffer())
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => socket.emit('offer', peerConnection.localDescription))
        .catch(error => console.error('Error during offer creation.', error));
}

function toggleMic() {
    micEnabled = !micEnabled;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = micEnabled);
    }
    micToggleButton.textContent = micEnabled ? 'Mic Off' : 'Mic On';
}

micToggleButton.addEventListener('click', toggleMic);

chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const message = chatInput.value;
        if (message) {
            socket.emit('chatMessage', {
                text: message,
                recipientId: getCurrentCallPartnerId()
            });
            chatInput.value = '';
        }
    }
});

socket.on('chatMessage', (message) => {
    const newMessage = document.createElement('div');
    newMessage.textContent = message.text;
    chatMessages.appendChild(newMessage);
});

function getCurrentCallPartnerId() {
    // Assuming there's a way to determine the ID of the current call partner
    // This function should return the ID of the current call partner
    return null; // Placeholder, implement as needed
}

window.onload = async () => {
    await startStream();
    startCall();
};
