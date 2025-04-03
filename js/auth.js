// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD3MI1klgBSHs1h6QT4VPNoScCfCwMV_Ck",
  authDomain: "usuario-b0384.firebaseapp.com",
  databaseURL: "https://usuario-b0384-default-rtdb.firebaseio.com",
  projectId: "usuario-b0384",
  storageBucket: "usuario-b0384.firebasestorage.app",
  messagingSenderId: "196266170863",
  appId: "1:196266170863:web:4ea57f489df94aba94fe1a"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Elementos del DOM
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const authMessage = document.getElementById('auth-message');

// Mostrar formulario de registro
showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    authMessage.style.display = 'none';
});

// Mostrar formulario de login
showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    authMessage.style.display = 'none';
});

// Login con email/password
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Redirigir a home después de login exitoso
            window.location.href = 'home.html';
        })
        .catch((error) => {
            showMessage(error.message, 'error');
        });
});

// Registro de nuevo usuario
document.getElementById('register-btn').addEventListener('click', () => {
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm').value;
    
    if (password !== confirmPassword) {
        showMessage('Las contraseñas no coinciden', 'error');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Guardar información adicional del usuario en la base de datos
            const user = userCredential.user;
            const userRef = database.ref('users/' + user.uid);
            
            userRef.set({
                name: name,
                email: email,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastLogin: firebase.database.ServerValue.TIMESTAMP
            });
            
            showMessage('Registro exitoso! Redirigiendo...', 'success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1500);
        })
        .catch((error) => {
            showMessage(error.message, 'error');
        });
});

// Mostrar mensajes de error/éxito
function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = 'auth-message ' + type;
    authMessage.style.display = 'block';
}

// Verificar estado de autenticación al cargar la página
auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario ya está logueado, redirigir a home
        window.location.href = 'home.html';
    }
});