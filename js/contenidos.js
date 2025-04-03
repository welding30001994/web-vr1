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
const openUploadModalBtn = document.getElementById('open-upload-modal');
const uploadModal = document.getElementById('upload-modal');
const cancelUploadBtn = document.getElementById('cancel-upload');
const confirmUploadBtn = document.getElementById('confirm-upload');
const contentTitle = document.getElementById('content-title');
const contentDescription = document.getElementById('content-description');
const contentFile = document.getElementById('content-file');
const uploadPreview = document.getElementById('upload-preview');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const gallery = document.getElementById('gallery');

// Variables globales
let currentUser = null;
let selectedFile = null;

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

// Modal de subida de contenido
openUploadModalBtn.addEventListener('click', () => {
  uploadModal.style.display = 'flex';
});

cancelUploadBtn.addEventListener('click', () => {
  uploadModal.style.display = 'none';
  resetUploadForm();
});

contentFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      uploadPreview.src = event.target.result;
      uploadPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

confirmUploadBtn.addEventListener('click', async () => {
  const title = contentTitle.value.trim();
  const description = contentDescription.value.trim();
  
  if (!title || !selectedFile) {
    alert('Por favor completa el título y selecciona un archivo');
    return;
  }
  
  try {
    uploadModal.style.display = 'none';
    progressContainer.style.display = 'block';
    
    // Subir archivo a Firebase Storage
    const filePath = `contents/${currentUser.uid}/${Date.now()}_${selectedFile.name}`;
    const fileRef = storage.ref(filePath);
    const uploadTask = fileRef.put(selectedFile);
    
    uploadTask.on('state_changed',
      (snapshot) => {
        // Actualizar barra de progreso
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        progressBar.style.width = progress + '%';
        progressText.textContent = Math.round(progress) + '% completado';
      },
      (error) => {
        console.error('Error al subir:', error);
        alert('Error al subir el archivo');
        progressContainer.style.display = 'none';
      },
      async () => {
        // Subida completada
        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
        
        // Guardar metadatos en Firestore
        await firestore.collection('contents').add({
          title,
          description,
          fileUrl: downloadURL,
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Usuario',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          likes: [],
          comments: []
        });
        
        // Resetear formulario
        resetUploadForm();
        progressContainer.style.display = 'none';
        
        // Recargar galería
        loadGallery();
      }
    );
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error al subir el contenido');
    progressContainer.style.display = 'none';
  }
});

function resetUploadForm() {
  contentTitle.value = '';
  contentDescription.value = '';
  contentFile.value = '';
  uploadPreview.style.display = 'none';
  selectedFile = null;
}

// Cargar galería de contenidos
function loadGallery() {
  firestore.collection('contents')
    .where('userId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      gallery.innerHTML = '';
      
      snapshot.forEach(doc => {
        const content = doc.data();
        addContentToGallery(content, doc.id);
      });
    });
}

function addContentToGallery(content, contentId) {
  const contentElement = document.createElement('div');
  contentElement.className = 'gallery-item';
  
  contentElement.innerHTML = `
    <img src="${content.fileUrl}" alt="${content.title}">
    <button class="delete-btn" data-id="${contentId}">
      <i class="fas fa-trash"></i>
    </button>
    <div class="gallery-item-info">
      <h3 class="gallery-item-title">${content.title}</h3>
      <p class="gallery-item-date">${formatDate(content.createdAt)}</p>
    </div>
  `;
  
  gallery.appendChild(contentElement);
  
  // Agregar evento de eliminación
  const deleteBtn = contentElement.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este contenido?')) {
      deleteContent(contentId, content.fileUrl);
    }
  });
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `Publicado el ${date.toLocaleDateString()}`;
}

async function deleteContent(contentId, fileUrl) {
  try {
    // Eliminar de Firestore
    await firestore.collection('contents').doc(contentId).delete();
    
    // Eliminar archivo de Storage
    const fileRef = storage.refFromURL(fileUrl);
    await fileRef.delete();
    
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error al eliminar el contenido');
  }
}

// Inicializar
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    currentUser = user;
    loadGallery();
  }
});