// src/App.js
import React, { useState, useEffect } from 'react';
import { auth, firestore } from './config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import SuperAdmin from './components/SuperAdmin';
import MapaQuillonFirebase from './components/MapaQuillonFirebase';
import SistemaTrabajadoresFirebase from './components/SistemaTrabajadoresFirebase';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Usuario autenticado, obtener su rol desde Firestore
        try {
          const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: userData.role,
              name: userData.name,
              ...userData
            });
          } else {
            // Usuario sin datos en Firestore
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: null
            });
          }
        } catch (error) {
          console.error('Error al obtener datos del usuario:', error);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: null
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Pantalla de carga
  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            margin: '0 auto 20px auto',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h2>Cargando MapaQuillón...</h2>
        </div>
      </div>
    );
  }

  // Si no hay usuario, mostrar login
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Renderizar según el rol del usuario
  switch (user.role) {
    case 'superadmin':
      return <SuperAdmin currentUser={user} onLogout={handleLogout} />;
    
    case 'admin':
      return <MapaQuillonFirebase currentUser={user} onLogout={handleLogout} />;
    
    case 'trabajador':
      return <SistemaTrabajadoresFirebase currentUser={user} onLogout={handleLogout} />;
    
    default:
      // Si no tiene rol definido, mostrar mensaje
      return (
        <div style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f3f4f6',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <h2 style={{ color: '#1f2937', marginBottom: '10px' }}>
              Rol no asignado
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
              Tu cuenta no tiene un rol asignado. Contacta al administrador del sistema.
            </p>
            <p style={{ 
              background: '#f3f4f6', 
              padding: '10px', 
              borderRadius: '6px',
              fontSize: '14px',
              color: '#374151',
              marginBottom: '20px'
            }}>
              Usuario: {user.email}
            </p>
            
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '10px 20px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      );
  }
}

export default App;