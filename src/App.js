// src/App.js - CORREGIDO con timeout de seguridad

import React, { useState, useEffect } from 'react';
import { auth, firestore } from './config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './components/Login';
import SuperAdmin from './components/SuperAdmin';
import MapaQuillonFirebase from './components/MapaQuillonFirebase';
import SistemaTrabajadoresFirebase from './components/SistemaTrabajadoresFirebase';
import DashboardTrabajador from './components/DashboardTrabajador';
import ZonesManagement from './components/ZonesManagement';
import FleetPanel from './components/FleetPanel';
import MonitorPanel from './components/MonitorPanel';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem('currentView');
    return savedView || 'admin';
  });
  const [trabajadorView, setTrabajadorView] = useState('gps');

  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    console.log('🚀 Iniciando App...');

    // IMPORTANTE: Timeout de seguridad para evitar carga infinita
    const loadingTimeout = setTimeout(() => {
      console.log('⏱️ Timeout alcanzado - forzando fin de carga');
      setLoading(false);
    }, 5000); // 5 segundos máximo de espera

    // Función para verificar localStorage
    const checkLocalStorage = async () => {
      console.log('📦 Verificando localStorage...');

      const isAuthenticated = localStorage.getItem('isAuthenticated');
      const storedUserData = localStorage.getItem('userData');

      if (isAuthenticated === 'true' && storedUserData) {
        try {
          const userData = JSON.parse(storedUserData);
          console.log('✅ Usuario encontrado en localStorage:', userData.email);
          setUser(userData);

          // Establecer vista según el rol
          const savedView = localStorage.getItem('currentView');
          if (savedView) {
            setCurrentView(savedView);
          } else {
            if (userData.role === 'superadmin') {
              setCurrentView('admin');
            } else if (userData.role === 'admin') {
              setCurrentView('dashboard');
            } else if (userData.role === 'junta_vecinos') {
              setCurrentView('junta_vecinos');
            } else if (userData.role === 'trabajador') {
              setTrabajadorView('gps');
            }
          }

          // Verificar datos en Firestore (sin bloquear)
          try {
            const userDoc = await getDoc(doc(firestore, 'users', userData.uid));
            if (userDoc.exists()) {
              const freshData = userDoc.data();
              const updatedUser = {
                uid: userData.uid,
                email: userData.email,
                role: freshData.role,
                name: freshData.name,
                localidad: freshData.localidad,
                ...freshData
              };
              setUser(updatedUser);
              localStorage.setItem('userData', JSON.stringify(updatedUser));
              console.log('✅ Datos actualizados desde Firestore');
            }
          } catch (error) {
            console.error('⚠️ Error verificando Firestore (no crítico):', error);
            // No es crítico, continuamos con los datos de localStorage
          }
        } catch (e) {
          console.error('❌ Error parseando localStorage:', e);
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('userData');
        }
      } else {
        console.log('📭 No hay sesión en localStorage');
      }
    };

    // Ejecutar verificación de localStorage inmediatamente
    checkLocalStorage();

    // Configurar listener de Firebase Auth
    let unsubscribe;
    try {
      console.log('🔥 Configurando Firebase Auth listener...');

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('🔔 Estado de autenticación cambió:', firebaseUser ? 'Usuario presente' : 'Sin usuario');

        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));

            if (userDoc.exists()) {
              const userData = userDoc.data();
              const userInfo = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: userData.role,
                name: userData.name,
                localidad: userData.localidad,
                ...userData
              };

              console.log('✅ Usuario autenticado:', userInfo.email, 'Rol:', userInfo.role);
              setUser(userInfo);

              // Guardar en localStorage
              localStorage.setItem('userData', JSON.stringify(userInfo));
              localStorage.setItem('isAuthenticated', 'true');

              // Establecer vista inicial según el rol
              if (userData.role === 'superadmin') {
                setCurrentView('admin');
              } else if (userData.role === 'admin') {
                setCurrentView('dashboard');
              } else if (userData.role === 'junta_vecinos') {
                setCurrentView('junta_vecinos');
              } else if (userData.role === 'trabajador') {
                setTrabajadorView('gps');
              }
            } else {
              console.warn('⚠️ Usuario en Auth pero no en Firestore');
              const userInfo = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: null
              };
              setUser(userInfo);
              localStorage.setItem('userData', JSON.stringify(userInfo));
              localStorage.setItem('isAuthenticated', 'true');
            }
          } catch (error) {
            console.error('❌ Error obteniendo datos del usuario:', error);
            const userInfo = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: null
            };
            setUser(userInfo);
            localStorage.setItem('userData', JSON.stringify(userInfo));
            localStorage.setItem('isAuthenticated', 'true');
          }
        } else {
          // No hay usuario en Firebase Auth
          const isAuthenticated = localStorage.getItem('isAuthenticated');
          const storedUserData = localStorage.getItem('userData');

          if (isAuthenticated === 'true' && storedUserData) {
            console.log('📦 Manteniendo sesión desde localStorage');
            // Ya se manejó en checkLocalStorage
          } else {
            console.log('🚪 Sin sesión - limpiando datos');
            setUser(null);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userData');
          }
        }

        // IMPORTANTE: Siempre quitar el loading al final
        console.log('✅ Finalizando carga');
        setLoading(false);
        clearTimeout(loadingTimeout); // Limpiar el timeout si terminamos antes
      }, (error) => {
        // Callback de error para onAuthStateChanged
        console.error('❌ Error en Firebase Auth:', error);
        setLoading(false);
        clearTimeout(loadingTimeout);
      });
    } catch (error) {
      console.error('❌ Error configurando Firebase:', error);
      setLoading(false);
      clearTimeout(loadingTimeout);
    }

    // Cleanup
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleLogin = (userData) => {
    console.log('🎉 Login exitoso:', userData.email);
    setUser(userData);

    // Guardar en localStorage
    localStorage.setItem('userData', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');

    // Establecer vista inicial según el rol
    if (userData.role === 'superadmin') {
      setCurrentView('admin');
    } else if (userData.role === 'admin') {
      setCurrentView('dashboard');
    } else if (userData.role === 'junta_vecinos') {
      setCurrentView('junta_vecinos');
    } else if (userData.role === 'trabajador') {
      setTrabajadorView('gps');
    }
  };

  const handleLogout = async () => {
    console.log('👋 Cerrando sesión...');
    try {
      // Limpiar localStorage primero
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userData');
      localStorage.removeItem('currentView');

      // Cerrar sesión en Firebase si hay usuario
      if (auth.currentUser) {
        await signOut(auth);
      }

      setUser(null);
      setCurrentView('dashboard');
      setTrabajadorView('gps');
      console.log('✅ Sesión cerrada');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      // Aunque falle Firebase, limpiar la sesión local
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userData');
      localStorage.removeItem('currentView');
      setUser(null);
    }
  };

  // Función para manejar cambio de vista del trabajador
  const handleTrabajadorViewChange = (view) => {
    if (view === 'dashboard-trabajador') {
      setTrabajadorView('dashboard');
    } else if (view === 'gps') {
      setTrabajadorView('gps');
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
          <p style={{
            marginTop: '10px',
            fontSize: '14px',
            opacity: 0.8
          }}>
            Si tarda más de 5 segundos, revisa tu conexión
          </p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
      // SuperAdmin puede acceder a todas las vistas
      if (currentView === 'admin') {
        return (
          <SuperAdmin
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      } else if (currentView === 'dashboard') {
        return (
          <MapaQuillonFirebase
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      } else if (currentView === 'zones') {
        return (
          <ZonesManagement
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      } else if (currentView === 'fleet') {
        return (
          <FleetPanel
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      }
      // Por defecto mostrar panel de admin
      return (
        <SuperAdmin
          currentUser={user}
          onLogout={handleLogout}
          onViewChange={setCurrentView}
          currentView={currentView}
        />
      );

    case 'admin':
      // Admin puede acceder a Dashboard, Zones y Fleet Panel
      if (currentView === 'dashboard') {
        return (
          <MapaQuillonFirebase
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      } else if (currentView === 'zones') {
        return (
          <ZonesManagement
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      } else if (currentView === 'fleet') {
        return (
          <FleetPanel
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        );
      }
      // Por defecto mostrar dashboard
      return (
        <MapaQuillonFirebase
          currentUser={user}
          onLogout={handleLogout}
          onViewChange={setCurrentView}
          currentView={currentView}
        />
      );

    case 'trabajador':
      // Trabajador puede cambiar entre Dashboard y GPS
      if (trabajadorView === 'dashboard') {
        return (
          <DashboardTrabajador
            currentUser={user}
            onLogout={handleLogout}
            onNavigateToGPS={() => setTrabajadorView('gps')}
          />
        );
      } else {
        return (
          <SistemaTrabajadoresFirebase
            currentUser={user}
            onLogout={handleLogout}
            onViewChange={handleTrabajadorViewChange}
          />
        );
      }
    case 'monitor':
      return <MonitorPanel currentUser={user} onLogout={handleLogout} />;

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