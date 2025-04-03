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
const copyIdBtn = document.getElementById('copy-id-btn');
const videoContainer = document.getElementById('video-container');
const callControls = document.getElementById('call-controls');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const endCallBtn = document.getElementById('end-call-btn');
const statusMessage = document.getElementById('status-message');

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

// Configuración de WebRTC
async function setupWebRTC() {
  try {
    showStatus('Obteniendo acceso a cámara y micrófono...');
    
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }, 
      audio: true 
    });
    localVideo.srcObject = localStream;
    
    // Configuración de PeerConnection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
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
      showStatus('Conexión establecida');
    };
    
    // Manejar cambios en la conexión
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'disconnected') {
        showStatus('Usuario desconectado');
        endCall();
      }
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
    showStatus('Error al acceder a cámara/micrófono', 'error');
  }
}

// Iniciar llamada
startCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim() || generateRoomId();
  
  if (!roomId) {
    showStatus('Por favor ingresa un ID válido', 'error');
    return;
  }
  
  // Mostrar el ID generado al usuario
  if (!callIdInput.value.trim()) {
    callIdInput.value = roomId;
    showStatus(`ID de llamada generado: ${roomId}. Comparte este ID con tu contacto.`);
  }
  
  isCaller = true;
  await setupWebRTC();
  
  // Crear oferta
  try {
    showStatus('Creando oferta de llamada...');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await peerConnection.setLocalDescription(offer);
    
    // Guardar oferta en Firebase
    await database.ref(`rooms/${roomId}`).set({
      offer: offer,
      caller: auth.currentUser.uid,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    // Escuchar respuesta
    database.ref(`rooms/${roomId}/answer`).on('value', async snapshot => {
      const answer = snapshot.val();
      if (answer) {
        showStatus('Usuario conectado!');
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
    
    // Limpiar sala después de 24 horas
    setTimeout(() => {
      database.ref(`rooms/${roomId}`).remove();
    }, 24 * 60 * 60 * 1000);
    
  } catch (error) {
    console.error('Error al iniciar llamada:', error);
    showStatus('Error al iniciar la llamada', 'error');
  }
});

// Copiar ID al portapapeles
copyIdBtn.addEventListener('click', () => {
  if (!roomId) {
    showStatus('Primero genera un ID de llamada', 'error');
    return;
  }
  
  callIdInput.select();
  document.execCommand('copy');
  showStatus('ID copiado al portapapeles!');
});

// Unirse a llamada
joinCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim();
  
  if (!roomId) {
    showStatus('Por favor ingresa un ID válido', 'error');
    return;
  }
  
  // Verificar si la sala existe
  const roomRef = database.ref(`rooms/${roomId}`);
  const snapshot = await roomRef.once('value');
  
  if (!snapshot.exists() || !snapshot.val().offer) {
    showStatus('No existe una llamada con ese ID', 'error');
    return;
  }
  
  isCaller = false;
  await setupWebRTC();
  
  try {
    showStatus('Uniéndose a la llamada...');
    const data = snapshot.val();
    
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    
    // Crear respuesta
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Guardar respuesta en Firebase
    await database.ref(`rooms/${roomId}/answer`).set(answer);
    
    // Escuchar ICE candidates
    database.ref(`rooms/${roomId}/candidates`).on('child_added', async snapshot => {
      const data = snapshot.val();
      if (data.sender === 'caller') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
    
    // Mostrar UI de llamada
    showCallUI();
    showStatus('Conectado a la llamada!');
    
  } catch (error) {
    console.error('Error al unirse a la llamada:', error);
    showStatus('Error al unirse a la llamada', 'error');
  }
});

// Mostrar UI de llamada
function showCallUI() {
  callSetup.style.display = 'none';
  videoContainer.style.display = 'grid';
  callControls.style.display = 'flex';
  statusMessage.style.display = 'none';
}

// Mostrar mensaje de estado
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.style.display = 'block';
  statusMessage.className = type;
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
    if (isCaller) {
      database.ref(`rooms/${roomId}`).remove();
    }
  }
  
  // Restaurar UI
  callSetup.style.display = 'block';
  videoContainer.style.display = 'none';
  callControls.style.display = 'none';
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  callIdInput.value = '';
  showStatus('Llamada finalizada');
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

// Generar ID de sala fácil de compartir
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Elimina caracteres confusos
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Verificar autenticación
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    showStatus('Bienvenido! Puedes iniciar o unirte a una llamada');
  }
});

// Limpiar salas antiguas al cargar
window.addEventListener('load', () => {
  // Limpiar salas con más de 1 hora de antigüedad
  database.ref('rooms').once('value').then(snapshot => {
    const now = Date.now();
    snapshot.forEach(room => {
      const createdAt = room.child('createdAt').val();
      if (createdAt && (now - createdAt) > 3600000) { // 1 hora
        database.ref(`rooms/${room.key}`).remove();
      }
    });
  });
});
