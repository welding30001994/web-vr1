// Inicializar Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD3MI1klgBSHs1h6QT4VPNoScCfCwMV_Ck",
  authDomain: "usuario-b0384.firebaseapp.com",
  databaseURL: "https://usuario-b0384-default-rtdb.firebaseio.com",
  projectId: "usuario-b0384",
  storageBucket: "usuario-b0384.firebasestorage.app",
  messagingSenderId: "196266170863",
  appId: "1:196266170863:web:4ea57f489df94aba94fe1a"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const database = firebase.database();

// Elementos del DOM
const profileForm = document.getElementById('profile-form');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileAge = document.getElementById('profile-age');
const profileGender = document.getElementById('profile-gender');
const profileBio = document.getElementById('profile-bio');
const profilePhoto = document.getElementById('profile-photo');
const cancelBtn = document.getElementById('cancel-btn');
const profileMessage = document.getElementById('profile-message');
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const logoutBtn = document.getElementById('logout-btn');

// Mostrar/ocultar menú desplegable
menuBtn.addEventListener('click', () => {
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
});

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        dropdownMenu.style.display = 'none';
    }
});

// Cerrar sesión
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});

// Cancelar edición
cancelBtn.addEventListener('click', () => {
    window.location.href = 'home.html';
});

// Cargar datos del perfil
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        profileEmail.value = user.email;
        
        // Cargar datos adicionales del usuario
        const userRef = database.ref('users/' + user.uid);
        userRef.on('value', (snapshot) => {
            const userData = snapshot.val();
            
            if (userData) {
                if (userData.name) profileName.value = userData.name;
                if (userData.age) profileAge.value = userData.age;
                if (userData.gender) profileGender.value = userData.gender;
                if (userData.bio) profileBio.value = userData.bio;
                if (userData.photo) profilePhoto.value = userData.photo;
            }
        });
    }
});

// Guardar cambios en el perfil
profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        showMessage('No hay usuario autenticado', 'error');
        return;
    }
    
    const userRef = database.ref('users/' + user.uid);
    
    const updates = {
        name: profileName.value,
        age: profileAge.value,
        gender: profileGender.value,
        bio: profileBio.value,
        photo: profilePhoto.value,
        lastUpdate: firebase.database.ServerValue.TIMESTAMP
    };
    
    userRef.update(updates)
        .then(() => {
            showMessage('Perfil actualizado correctamente', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        })
        .catch((error) => {
            showMessage('Error al actualizar el perfil: ' + error.message, 'error');
        });
});

// Mostrar mensajes
function showMessage(text, type) {
    profileMessage.textContent = text;
    profileMessage.className = 'message ' + type;
    profileMessage.style.display = 'block';
    
    setTimeout(() => {
        profileMessage.style.display = 'none';
    }, 3000);
}