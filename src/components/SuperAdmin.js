// src/components/SuperAdmin.js
import React, { useState, useEffect } from 'react';
import { auth, firestore } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

const SuperAdmin = ({ currentUser, onLogout }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'trabajador',
    phone: '',
    vehicleId: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Cargar lista de usuarios existentes
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersList = [];
      usersSnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Crear usuario en Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Guardar datos adicionales en Firestore
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        phone: formData.phone,
        vehicleId: formData.vehicleId || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        active: true
      });

      setMessage({ 
        type: 'success', 
        text: `Usuario ${formData.name} creado exitosamente` 
      });

      // Limpiar formulario
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'trabajador',
        phone: '',
        vehicleId: ''
      });

      // Recargar lista de usuarios
      loadUsers();
      setShowCreateForm(false);

    } catch (error) {
      console.error('Error al crear usuario:', error);
      
      let errorMessage = 'Error al crear usuario';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Este correo ya está registrado';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Correo electrónico inválido';
          break;
        case 'auth/weak-password':
          errorMessage = 'La contraseña debe tener al menos 6 caracteres';
          break;
        default:
          errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await deleteDoc(doc(firestore, 'users', userId));
        setMessage({ type: 'success', text: 'Usuario eliminado' });
        loadUsers();
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al eliminar usuario' });
      }
    }
  };

  const getUserStats = () => {
    const stats = {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      trabajadores: users.filter(u => u.role === 'trabajador').length,
      superadmins: users.filter(u => u.role === 'superadmin').length
    };
    return stats;
  };

  const stats = getUserStats();

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
              🔐 Panel de Super Administrador
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
              Gestión de Usuarios del Sistema
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>
              👤 {currentUser.name} ({currentUser.email})
            </span>
            <button
              onClick={onLogout}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Estadísticas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #667eea'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.total}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Total Usuarios</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.admins}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Administradores</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #22c55e'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.trabajadores}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Trabajadores</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #a855f7'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.superadmins}
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Super Admins</div>
          </div>
        </div>

        {/* Mensajes */}
        {message.text && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
            color: message.type === 'success' ? '#166534' : '#991b1b'
          }}>
            {message.text}
          </div>
        )}

        {/* Botón para mostrar/ocultar formulario */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          {showCreateForm ? '✖ Cancelar' : '➕ Crear Nuevo Usuario'}
        </button>

        {/* Formulario de creación */}
        {showCreateForm && (
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            marginBottom: '30px'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#1f2937', fontSize: '20px' }}>
              Crear Nuevo Usuario
            </h2>
            
            <form onSubmit={handleCreateUser}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    required
                    minLength="6"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Rol *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="trabajador">👷 Trabajador</option>
                    <option value="admin">👨‍💼 Administrador</option>
                    <option value="superadmin">🔐 Super Admin</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+56 9 XXXX XXXX"
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {formData.role === 'trabajador' && (
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      ID Vehículo (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                      placeholder="Ej: CAM001"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '20px',
                  padding: '12px 24px',
                  background: loading ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Creando...' : '✅ Crear Usuario'}
              </button>
            </form>
          </div>
        )}

        {/* Lista de usuarios */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '20px' }}>
              📋 Lista de Usuarios
            </h2>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Nombre
                  </th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Email
                  </th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Rol
                  </th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Teléfono
                  </th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Estado
                  </th>
                  <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937' }}>
                      {user.name}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280' }}>
                      {user.email}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: user.role === 'superadmin' ? '#ede9fe' : 
                                  user.role === 'admin' ? '#dbeafe' : '#dcfce7',
                        color: user.role === 'superadmin' ? '#6b21a8' : 
                               user.role === 'admin' ? '#1e40af' : '#15803d'
                      }}>
                        {user.role === 'superadmin' ? '🔐 Super Admin' :
                         user.role === 'admin' ? '👨‍💼 Admin' : '👷 Trabajador'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280' }}>
                      {user.phone || '-'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: user.active !== false ? '#dcfce7' : '#fee2e2',
                        color: user.active !== false ? '#15803d' : '#991b1b'
                      }}>
                        {user.active !== false ? '✅ Activo' : '❌ Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      {user.id !== currentUser.uid && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdmin;