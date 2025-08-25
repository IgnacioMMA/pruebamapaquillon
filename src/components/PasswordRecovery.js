// src/components/PasswordRecovery.js
import React, { useState } from 'react';
import { firestore } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

const PasswordRecovery = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    pin: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [userData, setUserData] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Generar contraseña temporal segura
  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = 'Temp@';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Verificar email y PIN
  const handleVerifyPin = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!formData.email || !formData.pin) {
      setMessage({ 
        type: 'error', 
        text: '❌ Por favor completa todos los campos' 
      });
      return;
    }

    if (formData.pin.length !== 4) {
      setMessage({ 
        type: 'error', 
        text: '❌ El PIN debe tener 4 dígitos' 
      });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Buscar usuario por email en Firestore
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', formData.email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMessage({ 
          type: 'error', 
          text: '❌ No existe un usuario con ese correo electrónico' 
        });
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() };
      
      // Verificar PIN
      let pinCorrecto = false;
      
      if (user.recoveryPin) {
        try {
          // Intentar decodificar si está en base64
          const storedPin = atob(user.recoveryPin);
          pinCorrecto = (formData.pin === storedPin);
        } catch (e) {
          // Si no está codificado, comparar directamente
          pinCorrecto = (formData.pin === user.recoveryPin);
        }
      } else {
        setMessage({ 
          type: 'error', 
          text: '❌ Este usuario no tiene PIN configurado. Contacta al administrador.' 
        });
        setLoading(false);
        return;
      }

      if (!pinCorrecto) {
        setMessage({ 
          type: 'error', 
          text: '❌ PIN incorrecto. Intenta nuevamente.' 
        });
        setLoading(false);
        return;
      }

      // Generar contraseña temporal
      const tempPassword = generateTemporaryPassword();
      setTemporaryPassword(tempPassword);

      // ESTRATEGIA SIMPLIFICADA: Solo guardar en Firestore
      // El login manejará la verificación y Firebase Auth se actualizará al cambiar la contraseña

      // Actualizar en Firestore
      await updateDoc(doc(firestore, 'users', user.id), {
        tempPassword: btoa(tempPassword),
        lastTempPassword: user.tempPassword || null, // Guardar la anterior si existe
        requirePasswordChange: true,
        passwordResetAt: new Date().toISOString(),
        resetMethod: 'PIN_RECOVERY',
        email: formData.email.toLowerCase().trim() // Asegurar que el email esté normalizado
      });

      setUserData(user);
      setStep(2);
      setMessage({ 
        type: 'success', 
        text: '✅ Contraseña temporal generada exitosamente' 
      });

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: '❌ Error al procesar la solicitud' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Copiar contraseña al portapapeles
  const copyToClipboard = () => {
    navigator.clipboard.writeText(temporaryPassword);
    setMessage({ 
      type: 'success', 
      text: '✅ Contraseña copiada al portapapeles' 
    });
    setTimeout(() => {
      if (message.type === 'success' && message.text.includes('copiada')) {
        setMessage({ type: '', text: '' });
      }
    }, 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '450px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'transparent',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '5px'
          }}
        >
          ✖
        </button>

        {/* Header */}
        <div style={{ marginBottom: '25px' }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '24px', 
            color: '#1f2937' 
          }}>
            🔐 Recuperar Contraseña
          </h2>
        </div>

        {/* Mensajes - Solo mostrar en paso 1 */}
        {message.text && step === 1 && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: message.type === 'success' ? '#dcfce7' : 
                       message.type === 'error' ? '#fee2e2' : 
                       message.type === 'warning' ? '#fef3c7' : '#e0f2fe',
            border: `1px solid ${
              message.type === 'success' ? '#86efac' : 
              message.type === 'error' ? '#fecaca' : 
              message.type === 'warning' ? '#fde68a' : '#7dd3fc'
            }`,
            color: message.type === 'success' ? '#166534' : 
                   message.type === 'error' ? '#991b1b' : 
                   message.type === 'warning' ? '#92400e' : '#075985',
            fontSize: '14px'
          }}>
            {message.text}
          </div>
        )}

        {/* PASO 1: Verificar Email y PIN */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="tu@correo.com"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none'
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                PIN de Seguridad (4 dígitos)
              </label>
              <input
                type="text"
                required
                maxLength="4"
                value={formData.pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setFormData({...formData, pin: value});
                }}
                placeholder="••••"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '24px',
                  textAlign: 'center',
                  letterSpacing: '15px',
                  fontWeight: 'bold'
                }}
              />
              <small style={{ 
                color: '#6b7280', 
                fontSize: '12px',
                display: 'block',
                marginTop: '5px'
              }}>
                Ingresa tu PIN de 4 dígitos
              </small>
            </div>

            <button
              type="button"
              onClick={handleVerifyPin}
              disabled={loading || formData.pin.length !== 4 || !formData.email}
              style={{
                width: '100%',
                padding: '14px',
                background: loading || formData.pin.length !== 4 || !formData.email ? '#9ca3af' : 
                          'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading || formData.pin.length !== 4 || !formData.email ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Verificando...' : 'Verificar PIN →'}
            </button>

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#f9fafb',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              <strong>¿No recuerdas tu PIN?</strong><br />
              Contacta al administrador del sistema<br />
              📞 +56 9 1234 5678<br />
              📧 admin@municipalidadquillon.cl
            </div>
          </div>
        )}

        {/* PASO 2: Mostrar contraseña temporal */}
        {step === 2 && (
          <div>
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '20px'
              }}>
                🔑
              </div>
              
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '20px',
                color: '#1f2937'
              }}>
                Contraseña Temporal Generada
              </h3>
            </div>

            {/* Mensaje de éxito */}
            {message.type === 'success' && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                background: '#dcfce7',
                border: '1px solid #86efac',
                color: '#166534',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message.text}
              </div>
            )}

            <div style={{
              marginBottom: '25px',
              padding: '20px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #0284c7'
            }}>
              <p style={{ 
                margin: '0 0 15px 0', 
                fontSize: '14px', 
                color: '#075985',
                fontWeight: '500'
              }}>
                Tu nueva contraseña temporal es:
              </p>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'white',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #0284c7'
              }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={temporaryPassword}
                  readOnly
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    color: '#0c4a6e',
                    fontWeight: 'bold',
                    background: 'transparent'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    padding: '5px 10px',
                    background: '#e0f2fe',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  style={{
                    padding: '5px 10px',
                    background: '#e0f2fe',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📋
                </button>
              </div>
            </div>

            <div style={{
              background: '#f3f4f6',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <h4 style={{ 
                margin: '0 0 10px 0', 
                color: '#374151', 
                fontSize: '14px' 
              }}>
                📝 Instrucciones:
              </h4>
              <ol style={{ 
                margin: 0, 
                paddingLeft: '20px', 
                fontSize: '13px', 
                color: '#4b5563' 
              }}>
                <li>Copia la contraseña temporal</li>
                <li>Cierra esta ventana</li>
                <li>Inicia sesión con tu email y esta contraseña</li>
                <li>El sistema te pedirá crear una nueva contraseña</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ✅ Ir a Iniciar Sesión
            </button>

            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '15px',
              textAlign: 'center'
            }}>
              Si tienes problemas, contacta al administrador
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordRecovery;