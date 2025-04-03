fantasia-bbw/
├── index.html          # Página de login/registro
├── home.html           # Página principal
├── perfil.html         # Edición de perfil
├── css/
│   ├── style.css       # Estilos generales
│   └── auth.css        # Estilos específicos para autenticación
├── js/
│   ├── auth.js         # Lógica de autenticación
│   ├── home.js         # Lógica de la página principal
│   └── perfil.js       # Lógica de edición de perfil
└── images/             # Carpeta para imágenes/icons





CHAT --- FIREBASE 
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    
    "posts": {
      "$postId": {
        ".validate": "newData.hasChildren(['content', 'userId', 'timestamp'])",
        "content": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 1000"
        },
        "userId": {
          ".validate": "newData.val() === auth.uid"
        },
        "timestamp": {
          ".validate": "newData.isNumber()"
        },
        "imageUrl": {
          ".validate": "newData.isString() || newData.val() == null"
        },
        "$other": {
          ".validate": false
        }
      }
    }
  }
}
