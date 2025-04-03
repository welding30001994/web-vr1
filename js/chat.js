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
const storage = firebase.storage();

// Variables globales
let currentUser = null;
let selectedContact = null;
let contacts = {};

// Elementos del DOM
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const contactsList = document.getElementById('contacts-list');
const messagesList = document.getElementById('messages-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const chatContainer = document.getElementById('chat-container');
const noChatSelected = document.getElementById('no-chat-selected');
const uploadModal = document.getElementById('upload-modal');
const uploadPreview = document.getElementById('upload-preview');
const modalFileInput = document.getElementById('modal-file-input');
const cancelUpload = document.getElementById('cancel-upload');
const confirmUpload = document.getElementById('confirm-upload');

// Tema oscuro/claro
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

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

// Menú de usuario
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', () => {
    dropdownMenu.style.display = 'none';
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});

// Cargar contactos
function loadContacts() {
    database.ref('users').on('value', (snapshot) => {
        contacts = snapshot.val();
        contactsList.innerHTML = '';
        
        for (const userId in contacts) {
            if (userId !== currentUser.uid) {
                const contact = contacts[userId];
                const contactElement = document.createElement('div');
                contactElement.className = 'contact';
                contactElement.innerHTML = `
                    <div class="contact-avatar">${contact.name.charAt(0)}</div>
                    <div class="contact-info">
                        <div class="contact-name">${contact.name}</div>
                        <div class="contact-lastmsg">${contact.lastMessage || 'No hay mensajes'}</div>
                    </div>
                `;
                
                contactElement.addEventListener('click', () => {
                    selectContact(userId, contact);
                });
                
                contactsList.appendChild(contactElement);
            }
        }
    });
}

// Seleccionar contacto
function selectContact(userId, contact) {
    selectedContact = { userId, ...contact };
    
    // Resaltar contacto seleccionado
    document.querySelectorAll('.contact').forEach(el => {
        el.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Mostrar área de chat
    chatContainer.style.display = 'flex';
    noChatSelected.style.display = 'none';
    
    // Cargar mensajes
    loadMessages(userId);
}

// Cargar mensajes
function loadMessages(contactId) {
    messagesList.innerHTML = '';
    
    const chatId = [currentUser.uid, contactId].sort().join('_');
    database.ref('chats/' + chatId).on('value', (snapshot) => {
        messagesList.innerHTML = '';
        const messages = snapshot.val() || {};
        
        // Ordenar mensajes por timestamp
        const sortedMessages = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);
        
        sortedMessages.forEach(msg => {
            addMessageToChat(msg, msg.senderId === currentUser.uid);
        });
        
        // Scroll al final
        messagesList.scrollTop = messagesList.scrollHeight;
    });
}

// Añadir mensaje al chat
function addMessageToChat(message, isSent) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    let content = `<div>${message.text}</div>`;
    if (message.imageUrl) {
        content += `<img src="${message.imageUrl}" class="message-img">`;
    }
    content += `<span class="message-time">${formatTime(message.timestamp)}</span>`;
    
    messageElement.innerHTML = content;
    messagesList.appendChild(messageElement);
    
    // Scroll al final
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Formatear hora
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Enviar mensaje de texto
function sendTextMessage() {
    const text = messageInput.value.trim();
    if (text === '') return;
    
    if (!selectedContact) {
        alert('Selecciona un contacto primero');
        return;
    }
    
    const chatId = [currentUser.uid, selectedContact.userId].sort().join('_');
    const message = {
        text,
        senderId: currentUser.uid,
        timestamp: Date.now()
    };
    
    database.ref('chats/' + chatId).push(message);
    
    // Actualizar último mensaje en el contacto
    database.ref(`users/${currentUser.uid}/contacts/${selectedContact.userId}/lastMessage`).set(text);
    database.ref(`users/${selectedContact.userId}/contacts/${currentUser.uid}/lastMessage`).set(text);
    
    messageInput.value = '';
}

// Enviar mensaje con imagen
function sendImageMessage(file) {
    if (!selectedContact) {
        alert('Selecciona un contacto primero');
        return;
    }
    
    const chatId = [currentUser.uid, selectedContact.userId].sort().join('_');
    const storageRef = storage.ref(`chat_images/${chatId}/${Date.now()}_${file.name}`);
    
    // Subir imagen
    const uploadTask = storageRef.put(file);
    
    uploadTask.on('state_changed',
        (snapshot) => {
            // Progreso de la subida
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Upload is ' + progress + '% done');
        },
        (error) => {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen');
        },
        () => {
            // Subida completada
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                const message = {
                    imageUrl: downloadURL,
                    senderId: currentUser.uid,
                    timestamp: Date.now()
                };
                
                database.ref('chats/' + chatId).push(message);
                
                // Actualizar último mensaje en el contacto
                database.ref(`users/${currentUser.uid}/contacts/${selectedContact.userId}/lastMessage`).set('📷 Imagen');
                database.ref(`users/${selectedContact.userId}/contacts/${currentUser.uid}/lastMessage`).set('📷 Imagen');
                
                // Cerrar modal
                uploadModal.style.display = 'none';
                uploadPreview.style.display = 'none';
            });
        }
    );
}

// Event listeners
sendBtn.addEventListener('click', sendTextMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendTextMessage();
    }
});

uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadModal.style.display = 'flex';
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadPreview.src = event.target.result;
            uploadPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

cancelUpload.addEventListener('click', () => {
    uploadModal.style.display = 'none';
    uploadPreview.style.display = 'none';
    fileInput.value = '';
});

confirmUpload.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) {
        sendImageMessage(file);
    }
});

// Inicializar chat cuando el usuario está autenticado
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        loadContacts();
    }
});