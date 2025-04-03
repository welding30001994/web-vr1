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
const firestore = firebase.firestore();

// Elementos del DOM
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const welcomeMessage = document.getElementById('welcome-message');
const postsWall = document.getElementById('posts-wall');

// Variables globales
let currentUser = null;

// Configuración del tema
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

// Menú de usuario
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

// Navegación a las secciones
document.getElementById('personas-card').addEventListener('click', () => {
    window.location.href = 'personas.html';
});

document.getElementById('videollamada-card').addEventListener('click', () => {
    window.location.href = 'videollamada.html';
});

document.getElementById('chat-card').addEventListener('click', () => {
    window.location.href = 'chat.html';
});

document.getElementById('contenidos-card').addEventListener('click', () => {
    window.location.href = 'contenidos.html';
});

// Cargar publicaciones del muro público
function loadPublicPosts() {
    firestore.collection('posts')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snapshot => {
            postsWall.innerHTML = '';
            
            snapshot.forEach(doc => {
                const post = doc.data();
                addPostToWall(post, doc.id);
            });
        });
}

// Añadir publicación al muro
function addPostToWall(post, postId) {
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.dataset.id = postId;
    
    let imageHtml = '';
    if (post.imageUrl) {
        imageHtml = `<img src="${post.imageUrl}" class="post-image" alt="Publicación">`;
    }
    
    postElement.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${post.userName.charAt(0)}</div>
            <div class="post-user-info">
                <h3 class="post-user-name">${post.userName}</h3>
                <p class="post-time">${formatDate(post.timestamp)}</p>
            </div>
        </div>
        <div class="post-content">${post.content}</div>
        ${imageHtml}
        <div class="post-actions">
            <button class="post-action" data-action="like">
                <i class="far fa-heart"></i> Me gusta
            </button>
            <button class="post-action" data-action="comment">
                <i class="far fa-comment"></i> Comentar
            </button>
            <button class="post-action delete-post" data-action="delete">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    // Mostrar botón de eliminar solo si es del usuario actual
    const deleteBtn = postElement.querySelector('.delete-post');
    if (currentUser && post.userId === currentUser.uid) {
        deleteBtn.style.display = 'flex';
        deleteBtn.addEventListener('click', () => deletePost(postId));
    }
    
    postsWall.appendChild(postElement);
}

// Formatear fecha
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return `Publicado el ${date.toLocaleDateString()} a las ${date.toLocaleTimeString()}`;
}

// Eliminar publicación
async function deletePost(postId) {
    if (confirm('¿Estás seguro de eliminar esta publicación?')) {
        try {
            await firestore.collection('posts').doc(postId).delete();
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar la publicación');
        }
    }
}

// Inicializar
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentUser = user;
        
        // Cargar nombre de usuario
        const userRef = firestore.collection('users').doc(user.uid);
        userRef.get().then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                welcomeMessage.textContent = `Bienvenido/a, ${userData.name || 'Usuario'}`;
            }
        });
        
        // Cargar publicaciones
        loadPublicPosts();
    }
});