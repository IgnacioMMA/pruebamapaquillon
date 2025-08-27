// src/components/Login.js - DISEÑO OFICIAL MUNICIPALIDAD DE QUILLÓN
import React, { useState } from 'react';
import PasswordRecovery from './PasswordRecovery';
import {
  signInWithEmailAndPassword,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, firestore } from '../config/firebase';
import { doc, getDoc, updateDoc, query, where, collection, getDocs, setDoc } from 'firebase/firestore';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estados para cambio de contraseña obligatorio
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Paleta de colores oficial de Quillón
  const colors = {
    primaryGreen: '#1B5E20',      // Verde oscuro (escudo)
    secondaryGreen: '#2E8B57',    // Verde medio
    lightGreen: '#4CAF50',        // Verde claro para hovers
    gold: '#FFD700',               // Dorado principal
    lightGold: '#FFB74D',         // Dorado claro para enlaces
    darkGold: '#FFA000',          // Dorado oscuro para hover
    white: '#FFFFFF',
    text: '#1B5E20',              // Texto en verde oscuro
    textLight: '#FFFFFF',         // Texto claro
    error: '#D32F2F',             // Rojo error
    success: '#388E3C',           // Verde éxito
    border: 'rgba(27, 94, 32, 0.2)', // Bordes verdes suaves
    background: '#F5F5F5'         // Fondo gris muy claro
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // PRIMERO: Verificar si existe una contraseña temporal en Firestore
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userFirestoreData = userDoc.data();
        const userDocId = userDoc.id;

        // NUEVA VALIDACIÓN: Verificar si el usuario está habilitado
        if (userFirestoreData.habilitado === false) {
          setError('🚫 Tu cuenta ha sido deshabilitada. Contacta al administrador del sistema.');
          setLoading(false);
          return;
        }

        // Verificar si hay contraseña temporal
        if (userFirestoreData.tempPassword) {
          try {
            const tempPasswordDecoded = atob(userFirestoreData.tempPassword);

            if (password === tempPasswordDecoded) {
              // Login exitoso con contraseña temporal
              await updateDoc(doc(firestore, 'users', userDocId), {
                lastLogin: new Date().toISOString()
              });

              if (userFirestoreData.requirePasswordChange === true) {
                setCurrentUser({
                  uid: userDocId,
                  email: userFirestoreData.email,
                  role: userFirestoreData.role,
                  name: userFirestoreData.name,
                  ...userFirestoreData,
                  isTempPasswordLogin: true
                });
                setOldPassword(password);
                setShowChangePassword(true);
                setLoading(false);
                return;
              } else {
                onLogin({
                  uid: userDocId,
                  email: userFirestoreData.email,
                  role: userFirestoreData.role,
                  name: userFirestoreData.name,
                  ...userFirestoreData
                });
                setLoading(false);
                return;
              }
            }
          } catch (e) {
            // Error decodificando contraseña temporal
          }
        }
      }

      // SEGUNDO: Intentar login normal con Firebase Auth
      try {
        const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        const user = userCredential.user;

        const userDoc = await getDoc(doc(firestore, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();

          // NUEVA VALIDACIÓN: Verificar si el usuario está habilitado (Firebase Auth)
          if (userData.habilitado === false) {
            // Cerrar sesión inmediatamente
            await signOut(auth);
            setError('🚫 Tu cuenta ha sido deshabilitada. Contacta al administrador del sistema.');
            setLoading(false);
            return;
          }

          if (userData.requirePasswordChange || userData.firstLogin !== false) {
            if (userData.tempPassword) {
              await updateDoc(doc(firestore, 'users', user.uid), {
                tempPassword: null,
                lastTempPassword: userData.tempPassword
              });
            }

            setCurrentUser({
              uid: user.uid,
              email: user.email,
              role: userData.role,
              name: userData.name,
              ...userData
            });
            setOldPassword(password);
            setShowChangePassword(true);
          } else {
            await updateDoc(doc(firestore, 'users', user.uid), {
              lastLogin: new Date().toISOString()
            });

            onLogin({
              uid: user.uid,
              email: user.email,
              role: userData.role,
              name: userData.name,
              ...userData
            });
          }
        } else {
          setError('No se encontraron datos del usuario');
        }
      } catch (authError) {
        // Manejo de errores de autenticación con fallback
        if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('email', '==', normalizedEmail));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userFirestoreData = userDoc.data();
            const userDocId = userDoc.id;

            // NUEVA VALIDACIÓN: Verificar si está habilitado en el fallback
            if (userFirestoreData.habilitado === false) {
              setError('🚫 Tu cuenta ha sido deshabilitada. Contacta al administrador del sistema.');
              setLoading(false);
              return;
            }

            if (userFirestoreData.tempPassword) {
              try {
                const storedPassword = atob(userFirestoreData.tempPassword);

                if (password === storedPassword) {
                  if (userFirestoreData.needsAuthSync === true) {
                    try {
                      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
                      const firebaseUser = auth.currentUser;

                      if (firebaseUser && firebaseUser.uid !== userDocId) {
                        await setDoc(doc(firestore, 'users', firebaseUser.uid), {
                          ...userFirestoreData,
                          tempPassword: null,
                          needsAuthSync: false,
                          authPasswordSynced: true,
                          requirePasswordChange: false,
                          lastLogin: new Date().toISOString()
                        });

                        await signOut(auth);

                        onLogin({
                          uid: firebaseUser.uid,
                          email: userFirestoreData.email,
                          role: userFirestoreData.role,
                          name: userFirestoreData.name,
                          ...userFirestoreData,
                          requirePasswordChange: false
                        });
                      } else {
                        await updateDoc(doc(firestore, 'users', userDocId), {
                          tempPassword: null,
                          needsAuthSync: false,
                          authPasswordSynced: true,
                          requirePasswordChange: false,
                          lastLogin: new Date().toISOString()
                        });

                        if (auth.currentUser) {
                          await signOut(auth);
                        }

                        onLogin({
                          uid: userDocId,
                          email: userFirestoreData.email,
                          role: userFirestoreData.role,
                          name: userFirestoreData.name,
                          ...userFirestoreData,
                          requirePasswordChange: false
                        });
                      }
                    } catch (syncError) {
                      await updateDoc(doc(firestore, 'users', userDocId), {
                        lastLogin: new Date().toISOString()
                      });

                      onLogin({
                        uid: userDocId,
                        email: userFirestoreData.email,
                        role: userFirestoreData.role,
                        name: userFirestoreData.name,
                        ...userFirestoreData,
                        requirePasswordChange: false
                      });
                    }
                  } else {
                    await updateDoc(doc(firestore, 'users', userDocId), {
                      lastLogin: new Date().toISOString()
                    });

                    onLogin({
                      uid: userDocId,
                      email: userFirestoreData.email,
                      role: userFirestoreData.role,
                      name: userFirestoreData.name,
                      ...userFirestoreData,
                      requirePasswordChange: false
                    });
                  }

                  setLoading(false);
                  return;
                }
              } catch (e) {
                // Error verificando contraseña de fallback
              }
            }
          }
        }

        throw authError;
      }
    } catch (error) {
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Usuario no encontrado. Verifica tu email');
          break;
        case 'auth/wrong-password':
          setError('Contraseña incorrecta');
          break;
        case 'auth/invalid-email':
          setError('Email inválido');
          break;
        case 'auth/too-many-requests':
          setError('Demasiados intentos. Intenta más tarde');
          break;
        case 'auth/invalid-credential':
          setError('Credenciales inválidas. Verifica tu email y contraseña');
          break;
        case 'auth/network-request-failed':
          setError('Error de conexión. Verifica tu internet');
          break;
        default:
          setError('Error al iniciar sesión. Intenta nuevamente');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword === oldPassword) {
      setError('La nueva contraseña debe ser diferente a la anterior');
      return;
    }

    const hasNumber = /\d/.test(newPassword);
    const hasLetter = /[a-zA-Z]/.test(newPassword);

    if (!hasNumber || !hasLetter) {
      setError('La contraseña debe contener al menos una letra y un número');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (currentUser.isTempPasswordLogin) {
        let authUpdated = false;

        try {
          await createUserWithEmailAndPassword(auth, currentUser.email, newPassword);
          authUpdated = true;

          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            if (currentUser.uid !== firebaseUser.uid) {
              const oldUserDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
              const oldUserData = oldUserDoc.exists() ? oldUserDoc.data() : {};

              await setDoc(doc(firestore, 'users', firebaseUser.uid), {
                ...oldUserData,
                email: currentUser.email,
                requirePasswordChange: false,
                firstLogin: false,
                passwordChangedAt: new Date().toISOString(),
                tempPassword: null,
                lastTempPassword: null,
                resetMethod: null,
                authPasswordSynced: true
              });

              currentUser.uid = firebaseUser.uid;
            } else {
              await updateDoc(doc(firestore, 'users', currentUser.uid), {
                requirePasswordChange: false,
                firstLogin: false,
                passwordChangedAt: new Date().toISOString(),
                tempPassword: null,
                lastTempPassword: null,
                resetMethod: null,
                authPasswordSynced: true
              });
            }

            await signOut(auth);
          }
        } catch (createError) {
          if (createError.code === 'auth/email-already-in-use') {
            if (currentUser.lastTempPassword) {
              try {
                const lastTemp = atob(currentUser.lastTempPassword);
                await signInWithEmailAndPassword(auth, currentUser.email, lastTemp);
                await updatePassword(auth.currentUser, newPassword);
                authUpdated = true;
                await signOut(auth);
              } catch (e) {
                // No funcionó con última temporal
              }
            }

            if (!authUpdated) {
              try {
                await signInWithEmailAndPassword(auth, currentUser.email, oldPassword);
                await updatePassword(auth.currentUser, newPassword);
                authUpdated = true;
                await signOut(auth);
              } catch (e) {
                // No funcionó con temporal actual
              }
            }

            if (!authUpdated) {
              await updateDoc(doc(firestore, 'users', currentUser.uid), {
                tempPassword: btoa(newPassword),
                requirePasswordChange: false,
                firstLogin: false,
                passwordChangedAt: new Date().toISOString(),
                lastTempPassword: btoa(oldPassword),
                resetMethod: 'FALLBACK_FIRESTORE',
                authPasswordSynced: false,
                needsAuthSync: true
              });

              setSuccessMessage('✅ Contraseña actualizada correctamente. Redirigiendo...');

              setTimeout(() => {
                window.location.reload();
              }, 3000);

              return;
            }
          } else {
            throw createError;
          }
        }

        if (authUpdated) {
          const userDocRef = doc(firestore, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            await updateDoc(userDocRef, {
              requirePasswordChange: false,
              firstLogin: false,
              passwordChangedAt: new Date().toISOString(),
              tempPassword: null,
              lastTempPassword: null,
              resetMethod: null,
              authPasswordSynced: true,
              needsAuthSync: false
            });
          } else {
            await setDoc(userDocRef, {
              email: currentUser.email,
              role: currentUser.role || 'worker',
              name: currentUser.name || '',
              requirePasswordChange: false,
              firstLogin: false,
              passwordChangedAt: new Date().toISOString(),
              tempPassword: null,
              lastTempPassword: null,
              resetMethod: null,
              authPasswordSynced: true,
              needsAuthSync: false
            });
          }

          setSuccessMessage('✅ Contraseña actualizada exitosamente');

          setTimeout(async () => {
            try {
              if (auth.currentUser) {
                await signOut(auth);
                await new Promise(resolve => setTimeout(resolve, 500));
              }

              const userCredential = await signInWithEmailAndPassword(auth, currentUser.email, newPassword);
              const user = userCredential.user;

              const userDocRef = doc(firestore, 'users', user.uid);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                onLogin({
                  uid: user.uid,
                  email: user.email,
                  role: userData.role,
                  name: userData.name,
                  ...userData,
                  requirePasswordChange: false,
                  firstLogin: false,
                  isTempPasswordLogin: false
                });
              } else {
                onLogin({
                  ...currentUser,
                  uid: user.uid,
                  requirePasswordChange: false,
                  firstLogin: false,
                  isTempPasswordLogin: false
                });
              }
            } catch (error) {
              onLogin({
                ...currentUser,
                requirePasswordChange: false,
                firstLogin: false,
                isTempPasswordLogin: false
              });
            }
          }, 2000);
        }
      } else {
        const user = auth.currentUser;

        if (user) {
          await updatePassword(user, newPassword);

          await updateDoc(doc(firestore, 'users', user.uid), {
            requirePasswordChange: false,
            firstLogin: false,
            passwordChangedAt: new Date().toISOString(),
            tempPassword: null,
            lastTempPassword: null,
            resetMethod: null
          });

          setSuccessMessage('✅ Contraseña actualizada exitosamente');

          setTimeout(() => {
            onLogin({
              ...currentUser,
              requirePasswordChange: false,
              firstLogin: false
            });
          }, 2000);
        } else {
          setError('Error de autenticación. Por favor, vuelve a iniciar sesión');
        }
      }
    } catch (error) {
      switch (error.code) {
        case 'auth/weak-password':
          setError('La contraseña es muy débil. Usa al menos 6 caracteres con letras y números');
          break;
        case 'auth/requires-recent-login':
          setError('Por seguridad, vuelve a iniciar sesión');
          break;
        case 'auth/network-request-failed':
          setError('Error de conexión. Verifica tu internet');
          break;
        default:
          setError('Error al cambiar la contraseña. Intenta nuevamente');
      }
    } finally {
      setLoading(false);
    }
  };

  // Formulario de cambio de contraseña obligatorio
  if (showChangePassword) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${colors.primaryGreen} 0%, ${colors.secondaryGreen} 100%)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{
          backgroundColor: colors.white,
          padding: '48px',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          maxWidth: '420px',
          width: '90%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: colors.gold,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px'
            }}>
              🔐
            </div>
            <h2 style={{
              color: colors.text,
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              Actualiza tu contraseña
            </h2>
            <p style={{
              color: colors.text,
              opacity: 0.7,
              margin: 0,
              fontSize: '14px'
            }}>
              Por tu seguridad, crea una nueva contraseña
            </p>
          </div>

          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Nueva Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  style={{
                    width: '100%',
                    padding: '12px',
                    paddingRight: '40px',
                    border: `2px solid ${colors.border}`,
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    backgroundColor: colors.white
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primaryGreen}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.primaryGreen,
                    fontSize: '18px'
                  }}
                >
                  {showNewPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Confirmar Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  style={{
                    width: '100%',
                    padding: '12px',
                    paddingRight: '40px',
                    border: `2px solid ${colors.border}`,
                    borderRadius: '10px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    backgroundColor: colors.white
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primaryGreen}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.primaryGreen,
                    fontSize: '18px'
                  }}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: 'rgba(27, 94, 32, 0.05)',
              borderRadius: '10px',
              fontSize: '12px',
              color: colors.text
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ marginRight: '8px', color: colors.success }}>✓</span> Mínimo 6 caracteres
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ marginRight: '8px', color: colors.success }}>✓</span> Al menos una letra
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ marginRight: '8px', color: colors.success }}>✓</span> Al menos un número
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '8px', color: colors.success }}>✓</span> Diferente a la anterior
              </div>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#FFEBEE',
                border: `1px solid #FFCDD2`,
                color: colors.error,
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '8px' }}>⚠️</span>
                {error}
              </div>
            )}

            {successMessage && (
              <div style={{
                backgroundColor: '#E8F5E9',
                border: `1px solid #A5D6A7`,
                color: colors.success,
                padding: '12px',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <span style={{ marginRight: '8px' }}>✅</span>
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: loading ? '#BDBDBD' : colors.gold,
                color: colors.text,
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.darkGold)}
              onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.gold)}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Actualizando...
                </>
              ) : (
                'Cambiar Contraseña'
              )}
            </button>
          </form>
        </div>

        <style>{`
          .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid ${colors.text};
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Formulario de login principal
  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: `linear-gradient(135deg, ${colors.primaryGreen} 0%, ${colors.secondaryGreen} 100%)`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Contenedor principal del formulario */}
      <div className="login-container" style={{
        backgroundColor: colors.white,
        padding: '32px 40px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        maxWidth: '420px',
        width: '90%',
        position: 'relative',
        zIndex: 1,
        border: `3px solid rgba(255, 255, 255, 0.5)`
      }}>
        {/* Logo y título */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Espacio para el logo oficial */}
          <div style={{
            width: '120px',
            height: '140px',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.white,
            borderRadius: '10px',
            padding: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {/* Aquí va el logo oficial - reemplazar con <img src="/logo-quillon.png" /> */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '150px',
                height: '150px',
                margin: '0 auto 8px',
                backgroundImage: 'url("/escudo-quillon.png")', // Ruta al logo
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center'
              }}>
                {/* Si no hay imagen, mostrar texto de respaldo */}
                <div style={{
                  fontSize: '12px',
                  color: colors.text,
                  paddingTop: '20px'
                }}>
                  {/* Logo Municipalidad */}
                </div>
              </div>
            </div>
          </div>

          <h1 style={{
            color: colors.text,
            margin: '0 0 8px 0',
            fontSize: '32px',
            fontWeight: '700'
          }}>
            MapaQuillón
          </h1>
          <p style={{
            color: colors.text,
            opacity: 0.7,
            margin: 0,
            fontSize: '14px'
          }}>
            Sistema de Control de Flota GPS
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: colors.text,
              fontSize: '13px',
              fontWeight: '500'
            }}>
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ejemplo@gmail.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `2px solid ${colors.border}`,
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: colors.white,
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = colors.primaryGreen}
              onBlur={(e) => e.target.style.borderColor = colors.border}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              color: colors.text,
              fontSize: '13px',
              fontWeight: '500'
            }}>
              Contraseña
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  border: `2px solid ${colors.border}`,
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: colors.white,
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = colors.primaryGreen}
                onBlur={(e) => e.target.style.borderColor = colors.border}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.primaryGreen,
                  fontSize: '16px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Mensajes de error y éxito */}
          {error && (
            <div style={{
              backgroundColor: '#FFEBEE',
              border: `1px solid #FFCDD2`,
              color: colors.error,
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '6px' }}>⚠️</span>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              backgroundColor: '#E8F5E9',
              border: `1px solid #A5D6A7`,
              color: colors.success,
              padding: '10px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{ marginRight: '6px' }}>✅</span>
              {successMessage}
            </div>
          )}

          {/* Botón de inicio de sesión */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#BDBDBD' : colors.gold,
              color: colors.text,
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 3px 10px rgba(255, 215, 0, 0.3)'
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.darkGold)}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = colors.gold)}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>

          {/* Enlace de recuperación de contraseña */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowPasswordRecovery(true)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.lightGold,
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = colors.darkGold}
              onMouseOut={(e) => e.currentTarget.style.color = colors.lightGold}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Modal de recuperación de contraseña */}
          {showPasswordRecovery && (
            <PasswordRecovery
              onClose={() => setShowPasswordRecovery(false)}
              onSuccess={() => {
                setShowPasswordRecovery(false);
                setSuccessMessage('✅ Ya puedes iniciar sesión con tu contraseña temporal');
                setTimeout(() => setSuccessMessage(''), 5000);
              }}
            />
          )}
        </form>

        {/* Información de contacto */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          backgroundColor: 'rgba(27, 94, 32, 0.05)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <p style={{
            color: colors.text,
            fontSize: '11px',
            margin: '0 0 4px 0',
            opacity: 0.7
          }}>
            ¿Necesitas ayuda?
          </p>
          <p style={{
            color: colors.text,
            fontSize: '12px',
            fontWeight: '500',
            margin: 0
          }}>
            Contacta al administrador<br />
            📞 +56 9 1234 5678
          </p>
        </div>
      </div>

      <style>{`
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid ${colors.text};
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 480px) {
          .login-container {
            padding: 24px !important;
            width: 92% !important;
            max-width: 380px !important;
          }
          
          img[alt="Escudo de Quillón"] {
            max-width: 90px !important;
          }
        }
        
        @media (min-width: 481px) and (max-width: 768px) {
          .login-container {
            padding: 28px 32px !important;
          }
          
          img[alt="Escudo de Quillón"] {
            max-width: 100px !important;
          }
        }
        
        @media (min-width: 769px) {
          img[alt="Escudo de Quillón"] {
            max-width: 110px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;