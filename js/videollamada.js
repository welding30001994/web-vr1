// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD3MI1klgBSHs1h6QT4VPNoScCfCwMV_Ck",
  authDomain: "usuario-b0384.firebaseapp.com",
  databaseURL: "https://usuario-b0384-default-rtdb.firebaseio.com",
  projectId: "usuario-b0384",
  storageBucket: "usuario-b0384.appspot.com",
  messagingSenderId: "196266170863",
  appId: "1:196266170863:web:4ea57f489df94aba94fe1a"
};

// Inicializar Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();

// Variables globales para la videollamada
let localStream;
let remoteStream;
let peerConnection;
let roomId;
let isCaller = false;

// Elementos del DOM
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const callSetup = document.getElementById('call-setup');
const callIdInput = document.getElementById('call-id');
const startCallBtn = document.getElementById('start-call-btn');
const joinCallBtn = document.getElementById('join-call-btn');
const videoContainer = document.getElementById('video-container');
const callControls = document.getElementById('call-controls');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const endCallBtn = document.getElementById('end-call-btn');

// Configuración del tema
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

// Configuración del menú
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', () => {
  dropdownMenu.style.display = 'none';
});

// Cerrar sesión
logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  auth.signOut().then(() => {
    window.location.href = 'index.html';
  });
});

// Toggle tema oscuro/claro
themeToggle.addEventListener('click', () => {
  const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon();
});

function updateThemeIcon() {
  const icon = themeToggle.querySelector('i');
  if (document.documentElement.getAttribute('data-theme') === 'dark') {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  } else {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  }
}

// Configuración de WebRTC (simplificada)
async function setupWebRTC() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    
    // Configuración básica de PeerConnection (debes implementar según tu necesidad)
    const configuration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Agregar stream local
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Manejar stream remoto
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
      remoteStream = event.streams[0];
    };
    
    // Manejar ICE candidates
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        database.ref(`rooms/${roomId}/candidates`).push({
          sender: isCaller ? 'caller' : 'callee',
          candidate: event.candidate
        });
      }
    };
    
  } catch (error) {
    console.error('Error al acceder a los dispositivos:', error);
    alert('No se pudo acceder a la cámara/micrófono');
  }
}

// Iniciar llamada
startCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim() || generateRoomId();
  if (!roomId) return;
  
  isCaller = true;
  await setupWebRTC();
  
  // Crear oferta
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  // Guardar oferta en Firebase
  database.ref(`rooms/${roomId}`).set({
    offer: offer,
    caller: auth.currentUser.uid
  });
  
  // Escuchar respuesta
  database.ref(`rooms/${roomId}/answer`).on('value', async snapshot => {
    const answer = snapshot.val();
    if (answer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });
  
  // Escuchar ICE candidates
  database.ref(`rooms/${roomId}/candidates`).on('child_added', async snapshot => {
    const data = snapshot.val();
    if (data.sender === 'callee') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
  
  // Mostrar UI de llamada
  showCallUI();
});

// Unirse a llamada
joinCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim();
  if (!roomId) return;
  
  isCaller = false;
  await setupWebRTC();
  
  // Escuchar oferta
  database.ref(`rooms/${roomId}`).on('value', async snapshot => {
    const data = snapshot.val();
    if (data && data.offer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Crear respuesta
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Guardar respuesta en Firebase
      database.ref(`rooms/${roomId}/answer`).set(answer);
    }
  });
  
  // Escuchar ICE candidates
  database.ref(`rooms/${roomId}/candidates`).on('child_added', async snapshot => {
    const data = snapshot.val();
    if (data.sender === 'caller') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
  
  // Enviar ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      database.ref(`rooms/${roomId}/candidates`).push({
        sender: 'callee',
        candidate: event.candidate
      });
    }
  };
  
  // Mostrar UI de llamada
  showCallUI();
});

// Mostrar UI de llamada
function showCallUI() {
  callSetup.style.display = 'none';
  videoContainer.style.display = 'grid';
  callControls.style.display = 'flex';
}

// Finalizar llamada
endCallBtn.addEventListener('click', () => {
  endCall();
});

function endCall() {
  // Limpiar streams
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }
  
  // Limpiar conexión
  if (peerConnection) {
    peerConnection.close();
  }
  
  // Limpiar Firebase
  if (roomId) {
    database.ref(`rooms/${roomId}`).off();
    database.ref(`rooms/${roomId}`).remove();
  }
  
  // Restaurar UI
  callSetup.style.display = 'block';
  videoContainer.style.display = 'none';
  callControls.style.display = 'none';
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
}

// Controles de llamada
muteBtn.addEventListener('click', () => {
  const audioTracks = localStream.getAudioTracks();
  audioTracks.forEach(track => {
    track.enabled = !track.enabled;
    muteBtn.querySelector('i').classList.toggle('fa-microphone-slash');
    muteBtn.querySelector('i').classList.toggle('fa-microphone');
  });
});

videoBtn.addEventListener('click', () => {
  const videoTracks = localStream.getVideoTracks();
  videoTracks.forEach(track => {
    track.enabled = !track.enabled;
    videoBtn.querySelector('i').classList.toggle('fa-video-slash');
    videoBtn.querySelector('i').classList.toggle('fa-video');
  });
});

// Generar ID de sala aleatorio
function generateRoomId() {
  return Math.random().toString(36).substring(2, 9);
}

// Verificar autenticación
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  }
});