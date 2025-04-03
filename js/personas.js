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
const storage = firebase.storage();

// Elementos del DOM
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const postContent = document.getElementById('post-content');
const postBtn = document.getElementById('post-btn');
const uploadPostBtn = document.getElementById('upload-post-btn');
const postImageInput = document.getElementById('post-image-input');
const postsList = document.getElementById('posts-list');
const uploadModal = document.getElementById('upload-modal');
const uploadPreview = document.getElementById('upload-preview');
const cancelUpload = document.getElementById('cancel-upload');
const confirmUpload = document.getElementById('confirm-upload');

// Variables globales
let currentUser = null;
let selectedImageFile = null;

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

// Cargar publicaciones del usuario
function loadUserPosts() {
  firestore.collection('posts')
    .where('userId', '==', currentUser.uid)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      postsList.innerHTML = '';
      
      snapshot.forEach(doc => {
        const post = doc.data();
        addPostToDOM(post, doc.id);
      });
    });
}

// Añadir publicación al DOM
function addPostToDOM(post, postId) {
  const postElement = document.createElement('div');
  postElement.className = 'post';
  postElement.dataset.id = postId;
  
  let imageHtml = '';
  if (post.imageUrl) {
    imageHtml = `<img src="${post.imageUrl}" class="post-image" alt="Publicación">`;
  }
  
  postElement.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${post.userName.charAt(0)}</div>
      <div>
        <div class="post-user">${post.userName}</div>
        <div class="post-time">${formatDate(post.timestamp)}</div>
      </div>
    </div>
    <div class="post-content">${post.content}</div>
    ${imageHtml}
    <div class="post-actions-bar">
      <button class="post-action" data-action="delete" data-id="${postId}">
        <i class="fas fa-trash"></i> Eliminar
      </button>
    </div>
  `;
  
  // Agregar evento de eliminación
  const deleteBtn = postElement.querySelector('[data-action="delete"]');
  deleteBtn.addEventListener('click', () => deletePost(postId));
  
  postsList.appendChild(postElement);
}

// Formatear fecha
function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `Publicado el ${date.toLocaleDateString()} a las ${date.toLocaleTimeString()}`;
}

// Publicar contenido
async function publishPost() {
  const content = postContent.value.trim();
  if (!content && !selectedImageFile) {
    alert('Por favor escribe un mensaje o selecciona una imagen');
    return;
  }

  try {
    let imageUrl = '';
    
    // Subir imagen si hay una seleccionada
    if (selectedImageFile) {
      const storageRef = storage.ref(`posts/${currentUser.uid}/${Date.now()}_${selectedImageFile.name}`);
      const uploadTask = await storageRef.put(selectedImageFile);
      imageUrl = await uploadTask.ref.getDownloadURL();
    }
    
    // Obtener nombre de usuario
    const userDoc = await firestore.collection('users').doc(currentUser.uid).get();
    const userName = userDoc.exists ? userDoc.data().name : 'Usuario';
    
    // Crear publicación en Firestore
    await firestore.collection('posts').add({
      content,
      imageUrl,
      userId: currentUser.uid,
      userName: userName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      likes: [],
      comments: []
    });
    
    // Limpiar formulario
    postContent.value = '';
    selectedImageFile = null;
    uploadModal.style.display = 'none';
    uploadPreview.style.display = 'none';
    
  } catch (error) {
    console.error('Error al publicar:', error);
    alert('Error al publicar el contenido');
  }
}

// Eliminar publicación
async function deletePost(postId) {
  if (!confirm('¿Estás seguro de eliminar esta publicación?')) return;
  
  try {
    // Primero obtenemos la publicación para ver si tiene imagen
    const postDoc = await firestore.collection('posts').doc(postId).get();
    const post = postDoc.data();
    
    // Eliminar imagen de Storage si existe
    if (post.imageUrl) {
      const fileRef = storage.refFromURL(post.imageUrl);
      await fileRef.delete();
    }
    
    // Eliminar documento de Firestore
    await firestore.collection('posts').doc(postId).delete();
    
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error al eliminar la publicación');
  }
}

// Manejar subida de imágenes
uploadPostBtn.addEventListener('click', () => {
  postImageInput.click();
});

postImageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedImageFile = file;
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
  postImageInput.value = '';
  selectedImageFile = null;
});

confirmUpload.addEventListener('click', () => {
  uploadModal.style.display = 'none';
});

postBtn.addEventListener('click', publishPost);

// Verificar autenticación y cargar datos
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    currentUser = user;
    loadUserPosts();
  }
});