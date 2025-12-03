// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCjb6ljHpfC1Nk6jD5GAGJQqF6VpGQeuw8",
  authDomain: "phone-phixer.firebaseapp.com",
  projectId: "phone-phixer",
  storageBucket: "phone-phixer.firebasestorage.app",
  messagingSenderId: "147775686514",
  appId: "1:147775686514:web:44695eca991d4503a17feb",
  measurementId: "G-RBHWDC1C24"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export {app, analytics}