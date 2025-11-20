// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Configuración de Firebase (reemplaza con tus valores reales de la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyBUgXIGzGHCP8m9UojcyrLLSGchD8s07ic",
  authDomain: "bakery-manager-bwoiw.firebaseapp.com",
  projectId: "bakery-manager-bwoiw",
  storageBucket: "bakery-manager-bwoiw.firebasestorage.app",
  messagingSenderId: "943048241096",
  appId: "1:943048241096:web:236d103cdef58dda2ddafd",
  // measurementId: "G-XXXXXXXXXX" // Descomenta si tienes uno
};

let app: FirebaseApp;
let authInstance: any; 
let firestoreInstance: any;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

// Conectar a los emuladores SOLO en entorno de desarrollo
if (typeof window !== 'undefined' && window.location.hostname === "localhost" && process.env.NODE_ENV === 'development') {
  console.log("Modo desarrollo detectado, intentando conectar a emuladores de Firebase...");

  // Comprobar si ya está conectado al emulador de Firestore
  // @ts-ignore
  if (!firestoreInstance && (!db._settings?.host || !db._settings.host.includes('localhost'))) {
    try {
      console.log("Conectando al emulador de Firestore en localhost:8081...");
      connectFirestoreEmulator(db, 'localhost', 8081); // <--- CAMBIO DE PUERTO
      firestoreInstance = db; 
      console.log("Conectado al emulador de Firestore en el puerto 8081.");
    } catch (error) {
      console.error("Error al conectar con el emulador de Firestore:", error);
    }
  } else if (firestoreInstance) {
    console.log("El emulador de Firestore ya está conectado.");
  }

  // Comprobar si ya está conectado al emulador de Auth
  // @ts-ignore
  if (!authInstance && !auth.config?.emulatorConfig) {
    try {
      console.log("Conectando al emulador de Authentication en http://localhost:9099...");
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      authInstance = auth; 
      console.log("Conectado al emulador de Authentication.");
    } catch (error) {
      console.error("Error al conectar con el emulador de Authentication:", error);
    }
  } else if (authInstance) {
    console.log("El emulador de Authentication ya está conectado.");
  }
} else {
  console.log("Modo producción o entorno no local, usando servicios Firebase en la nube.");
}

export { app, db, auth };
