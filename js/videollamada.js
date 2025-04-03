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
let screenStream;
let isSharingScreen = false;

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

// Configuración de WebRTC con mejores servidores ICE
async function setupWebRTC() {
  try {
    // Mostrar animación de carga
    localVideo.style.background = 'linear-gradient(45deg, #ff00cc, #3333ff)';
    localVideo.style.backgroundSize = '400% 400%';
    localVideo.style.animation = 'gradientBG 5s ease infinite';
    
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Aplicar efecto espejo al video local
    localVideo.style.transform = 'scaleX(-1)';
    localVideo.srcObject = localStream;
    localVideo.style.animation = 'none';
    
    // Configuración mejorada de PeerConnection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { 
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        }
      ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Agregar stream local
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Manejar stream remoto con animación
    peerConnection.ontrack = event => {
      remoteVideo.srcObject = event.streams[0];
      remoteStream = event.streams[0];
      
      // Animación cuando se conecta el video remoto
      remoteVideo.style.animation = 'fadeIn 1s ease-in';
      setTimeout(() => {
        remoteVideo.style.animation = '';
      }, 1000);
    };
    
    // Manejar cambios en la conexión
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'disconnected') {
        showNotification('Usuario desconectado');
        setTimeout(() => endCall(), 2000);
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
    
    // Manejar negociación de conexión
    peerConnection.onnegotiationneeded = async () => {
      try {
        if (isCaller) {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          await database.ref(`rooms/${roomId}`).update({
            offer: peerConnection.localDescription
          });
        }
      } catch (error) {
        console.error('Error en negociación:', error);
      }
    };
    
  } catch (error) {
    console.error('Error al acceder a los dispositivos:', error);
    showNotification('No se pudo acceder a la cámara/micrófono', 'error');
    localVideo.style.animation = 'none';
  }
}

// Iniciar llamada
startCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim() || generateRoomId();
  
  if (!roomId) {
    showNotification('Por favor ingresa un ID válido', 'error');
    return;
  }
  
  // Mostrar el ID generado al usuario
  if (!callIdInput.value.trim()) {
    callIdInput.value = roomId;
    showNotification(`ID de llamada generado: ${roomId}. Comparte este ID.`);
  }
  
  isCaller = true;
  await setupWebRTC();
  
  try {
    // Crear oferta
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await peerConnection.setLocalDescription(offer);
    
    // Guardar oferta en Firebase
    await database.ref(`rooms/${roomId}`).set({
      offer: offer,
      caller: auth.currentUser.uid,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      screenSharing: false
    });
    
    // Escuchar respuesta
    database.ref(`rooms/${roomId}/answer`).on('value', async snapshot => {
      const answer = snapshot.val();
      if (answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        showNotification('Usuario conectado!');
      }
    });
    
    // Escuchar ICE candidates
    database.ref(`rooms/${roomId}/candidates`).on('child_added', async snapshot => {
      const data = snapshot.val();
      if (data.sender === 'callee') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
    
    // Escuchar solicitud de compartir pantalla
    database.ref(`rooms/${roomId}/screenSharing`).on('value', snapshot => {
      if (snapshot.val() === true && !isCaller) {
        showNotification('El usuario está compartiendo pantalla');
      }
    });
    
    // Mostrar UI de llamada
    showCallUI();
    
  } catch (error) {
    console.error('Error al iniciar llamada:', error);
    showNotification('Error al iniciar la llamada', 'error');
  }
});

// Unirse a llamada
joinCallBtn.addEventListener('click', async () => {
  roomId = callIdInput.value.trim();
  
  if (!roomId) {
    showNotification('Por favor ingresa un ID válido', 'error');
    return;
  }
  
  // Verificar si la sala existe
  const roomRef = database.ref(`rooms/${roomId}`);
  const snapshot = await roomRef.once('value');
  
  if (!snapshot.exists() || !snapshot.val().offer) {
    showNotification('No existe una llamada con ese ID', 'error');
    return;
  }
  
  isCaller = false;
  await setupWebRTC();
  
  try {
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
    
    // Escuchar solicitud de compartir pantalla
    database.ref(`rooms/${roomId}/screenSharing`).on('value', snapshot => {
      if (snapshot.val() === true) {
        showNotification('El usuario está compartiendo pantalla');
      }
    });
    
    // Mostrar UI de llamada
    showCallUI();
    showNotification('Conectado a la llamada!');
    
  } catch (error) {
    console.error('Error al unirse a la llamada:', error);
    showNotification('Error al unirse a la llamada', 'error');
  }
});

// Mostrar UI de llamada
function showCallUI() {
  callSetup.style.display = 'none';
  videoContainer.style.display = 'grid';
  callControls.style.display = 'flex';
  
  // Agregar botón de compartir pantalla si no existe
  if (!document.getElementById('screen-share-btn')) {
    const screenShareBtn = document.createElement('button');
    screenShareBtn.id = 'screen-share-btn';
    screenShareBtn.className = 'control-button';
    screenShareBtn.innerHTML = '<i class="fas fa-desktop"></i>';
    screenShareBtn.title = 'Compartir pantalla';
    screenShareBtn.addEventListener('click', toggleScreenShare);
    callControls.insertBefore(screenShareBtn, endCallBtn);
  }
}

// Compartir pantalla
async function toggleScreenShare() {
  try {
    if (!isSharingScreen) {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Reemplazar pista de video
      const videoTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      await sender.replaceTrack(videoTrack);
      
      // Mostrar notificación
      showNotification('Compartiendo pantalla');
      isSharingScreen = true;
      
      // Notificar al otro usuario
      if (isCaller) {
        await database.ref(`rooms/${roomId}`).update({
          screenSharing: true
        });
      }
      
      // Cuando se detiene el compartir pantalla
      videoTrack.onended = () => {
        toggleScreenShare();
      };
      
    } else {
      // Volver a la cámara normal
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      await sender.replaceTrack(videoTrack);
      
      // Detener el stream de pantalla
      screenStream.getTracks().forEach(track => track.stop());
      screenStream = null;
      isSharingScreen = false;
      
      // Notificar al otro usuario
      if (isCaller) {
        await database.ref(`rooms/${roomId}`).update({
          screenSharing: false
        });
      }
      
      showNotification('Dejaste de compartir pantalla');
    }
  } catch (error) {
    console.error('Error al compartir pantalla:', error);
    showNotification('Error al compartir pantalla', 'error');
  }
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
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
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
  
  // Eliminar botón de compartir pantalla si existe
  const screenShareBtn = document.getElementById('screen-share-btn');
  if (screenShareBtn) {
    screenShareBtn.remove();
  }
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

// Mostrar notificación
function showNotification(message, type = 'info') {
  // Crear notificación si no existe
  if (!document.getElementById('notification-container')) {
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.bottom = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Estilos para la notificación
  notification.style.padding = '15px 25px';
  notification.style.margin = '10px 0';
  notification.style.borderRadius = '8px';
  notification.style.color = 'white';
  notification.style.backgroundColor = type === 'error' ? '#ff4444' : '#4285f4';
  notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  notification.style.animation = 'fadeIn 0.5s, fadeOut 0.5s 2.5s forwards';
  
  document.getElementById('notification-container').appendChild(notification);
  
  // Eliminar notificación después de 3 segundos
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Verificar autenticación
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  }
});

// Agregar estilos para animaciones
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;
document.head.appendChild(style);
