// src/components/NotificationSystem.js

import React, { useState, useEffect, useRef } from 'react';
import { database } from '../config/firebase';
import {
  ref,
  onValue,
  push,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  off
} from 'firebase/database';

// Función helper para crear notificaciones
export const createNotification = async (userId, notification) => {
  try {
    const notificacionesRef = ref(database, 'notificaciones');
    await push(notificacionesRef, {
      ...notification,
      destinatario: userId,
      timestamp: new Date().toISOString(),
      leido: false
    });
  } catch (error) {
    console.error('Error al crear notificación:', error);
  }
};

const NotificationSystem = ({
  currentUser,
  isMobile = false,
  inSidebar = false,
  isCollapsed = false,
  onNotificationCountChange
}) => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Cargar notificaciones en tiempo real
  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);

    // Crear query para notificaciones del usuario actual
    const notificacionesRef = ref(database, 'notificaciones');
    const userNotificationsQuery = query(
      notificacionesRef,
      orderByChild('destinatario'),
      equalTo(currentUser.uid)
    );

    // Listener en tiempo real
    unsubscribeRef.current = onValue(userNotificationsQuery, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const notificationsList = Object.entries(data)
          .map(([id, notification]) => ({
            id,
            ...notification
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 50); // Limitar a las últimas 50 notificaciones

        setNotifications(notificationsList);

        // Contar no leídas
        const unread = notificationsList.filter(n => !n.leido).length;
        setUnreadCount(unread);

        // Notificar al componente padre si existe
        if (onNotificationCountChange) {
          onNotificationCountChange(unread);
        }

        // Reproducir sonido si hay nueva notificación no leída
        if (unread > 0 && notificationsList[0] && !notificationsList[0].leido) {
          playNotificationSound();
        }
      } else {
        setNotifications([]);
        setUnreadCount(0);
        if (onNotificationCountChange) {
          onNotificationCountChange(0);
        }
      }

      setLoading(false);
    }, (error) => {
      console.error('Error al cargar notificaciones:', error);
      setLoading(false);
    });

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        off(userNotificationsQuery);
      }
    };
  }, [currentUser?.uid, onNotificationCountChange]);

  // Marcar como leída (actualización en tiempo real)
  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = ref(database, `notificaciones/${notificationId}`);
      await update(notificationRef, {
        leido: true,
        fechaLectura: new Date().toISOString()
      });
      // No necesitamos actualizar el estado local, el listener lo hará automáticamente
    } catch (error) {
      console.error('Error al marcar como leída:', error);
    }
  };

  // Eliminar notificación (actualización en tiempo real)
  const deleteNotification = async (notificationId) => {
    try {
      const notificationRef = ref(database, `notificaciones/${notificationId}`);
      await remove(notificationRef);
      // No necesitamos actualizar el estado local, el listener lo hará automáticamente
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const updates = {};
      notifications
        .filter(n => !n.leido)
        .forEach(notification => {
          updates[`notificaciones/${notification.id}/leido`] = true;
          updates[`notificaciones/${notification.id}/fechaLectura`] = new Date().toISOString();
        });

      if (Object.keys(updates).length > 0) {
        const dbRef = ref(database);
        await update(dbRef, updates);
      }
    } catch (error) {
      console.error('Error al marcar todas como leídas:', error);
    }
  };

  // Eliminar todas las notificaciones
  const deleteAllNotifications = async () => {
    if (!window.confirm('¿Estás seguro de eliminar todas las notificaciones?')) return;

    try {
      const updates = {};
      notifications.forEach(notification => {
        updates[`notificaciones/${notification.id}`] = null;
      });

      if (Object.keys(updates).length > 0) {
        const dbRef = ref(database);
        await update(dbRef, updates);
      }
    } catch (error) {
      console.error('Error al eliminar todas las notificaciones:', error);
    }
  };

  // Reproducir sonido de notificación
  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('No se pudo reproducir sonido:', e));
    } catch (error) {
      console.log('Error al reproducir sonido:', error);
    }
  };

  // Formatear tiempo relativo
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Ahora mismo';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`;
    if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
    return date.toLocaleDateString('es-CL');
  };

  // Obtener icono según tipo de notificación
  const getNotificationIcon = (tipo) => {
    const icons = {
      'licencia_proxima': '⚠️',
      'licencia_vencida': '🚫',
      'documento_vencido': '📄',
      'vehiculo_asignado': '🚛',
      'zona_asignada': '🗺️',
      'tarea_completada': '✅',
      'mantenimiento': '🔧',
      'alerta': '🔔',
      'info': 'ℹ️',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️'
    };
    return icons[tipo] || '📬';
  };

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Si está en el sidebar y colapsado, solo mostrar el ícono
  if (inSidebar && isCollapsed) {
    return (
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '20px',
            position: 'relative',
            padding: '8px'
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              padding: '2px 4px',
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div ref={notificationRef} style={{ position: 'relative' }}>
      {/* Botón de notificaciones */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        style={{
          position: 'relative',
          padding: inSidebar ? (isMobile ? '10px' : '8px 12px') : '8px 16px',
          background: inSidebar ? 'transparent' : 'rgba(255,255,255,0.1)',
          color: inSidebar ? 'inherit' : 'white',
          border: inSidebar ? 'none' : '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: isMobile ? '15px' : '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: inSidebar ? '100%' : 'auto',
          justifyContent: inSidebar ? 'flex-start' : 'center',
          minHeight: isMobile && inSidebar ? '44px' : 'auto'
        }}
      >
        <span style={{ fontSize: '18px', position: 'relative' }}>
          🔔
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#ef4444',
              color: 'white',
              fontSize: '11px',
              padding: '2px 5px',
              borderRadius: '10px',
              minWidth: '18px',
              textAlign: 'center',
              fontWeight: 'bold',
              animation: 'pulse 2s infinite'
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        {!isMobile && !inSidebar && <span>Notificaciones</span>}
        {inSidebar && !isCollapsed && <span>Notificaciones</span>}
      </button>
      {/* Overlay para móvil */}
      {showNotifications && isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9999
          }}
          onClick={() => setShowNotifications(false)}
        />
      )}
      {/* Dropdown de notificaciones */}

      {showNotifications && (
        <div style={{
          position: 'absolute',
          // Ajustar top para que no se corte arriba
          top: inSidebar && !isMobile ? '0' : (isMobile && inSidebar ? '80px' : (isMobile ? '60px' : '100%')),
          left: inSidebar && !isMobile ? 'calc(100% + 10px)' : (isMobile && inSidebar ? '20px' : (isMobile ? '50%' : 'auto')),
          right: !inSidebar && !isMobile ? '0' : 'auto',
          // Sin transform vertical cuando está en sidebar desktop
          transform: isMobile && !inSidebar ? 'translateX(-50%)' : 'none',
          marginTop: !isMobile && !inSidebar ? '10px' : '0',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          width: isMobile ? 'calc(100vw - 40px)' : '380px',
          maxWidth: isMobile ? '400px' : '380px',
          maxHeight: isMobile ? 'calc(100vh - 120px)' : '500px',
          overflow: 'hidden',
          zIndex: 1001,
          animation: 'slideIn 0.2s ease'
        }}>
          {/* Header */}
          <div style={{
            padding: isMobile ? '12px 16px' : '15px 20px',
            borderBottom: '1px solid #e5e7eb',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            color: 'white',
            position: 'sticky', // Hacer el header sticky
            top: 0,
            zIndex: 1
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: isMobile ? '15px' : '16px',
                fontWeight: '600'
              }}>
                Notificaciones {unreadCount > 0 && `(${unreadCount})`}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: isMobile ? '6px 10px' : '4px 8px',
                      borderRadius: '4px',
                      fontSize: isMobile ? '13px' : '12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Marcar todas como leídas"
                  >
                    ✓ Todas
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAllNotifications}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: isMobile ? '6px 10px' : '4px 8px',
                      borderRadius: '4px',
                      fontSize: isMobile ? '13px' : '12px',
                      cursor: 'pointer'
                    }}
                    title="Eliminar todas"
                  >
                    🗑️
                  </button>
                )}
                {/* Botón de cerrar para móvil */}
                {isMobile && (
                  <button
                    onClick={() => setShowNotifications(false)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      marginLeft: '8px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lista de notificaciones - MANTÉN EL RESTO IGUAL */}
          <div style={{
            maxHeight: isMobile ? 'calc(100vh - 180px)' : 'calc(500px - 60px)', // Ajustar altura
            maxHeight: isMobile ? 'calc(100vh - 180px)' : '400px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            {loading ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '20px', marginBottom: '10px' }}>⏳</div>
                <div>Cargando notificaciones...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px', opacity: 0.3 }}>📭</div>
                <div>No tienes notificaciones</div>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: isMobile ? '12px 16px' : '15px 20px',
                    borderBottom: '1px solid #e5e7eb',
                    background: notification.leido ? 'white' : '#f0f9ff',
                    position: 'relative',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    minHeight: isMobile ? '60px' : 'auto'
                  }}
                  onClick={() => !notification.leido && markAsRead(notification.id)}
                  onMouseEnter={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.background = notification.leido ? '#f9fafb' : '#e0f2fe';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.background = notification.leido ? 'white' : '#f0f9ff';
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: isMobile ? '10px' : '12px' }}>
                    <div style={{
                      fontSize: isMobile ? '18px' : '20px',
                      marginTop: '2px',
                      flexShrink: 0
                    }}>
                      {getNotificationIcon(notification.tipo)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: notification.leido ? '400' : '600',
                        color: '#1f2937',
                        marginBottom: '4px',
                        wordBreak: 'break-word'
                      }}>
                        {notification.titulo || notification.mensaje}
                      </div>
                      {notification.titulo && notification.mensaje && (
                        <div style={{
                          fontSize: isMobile ? '12px' : '13px',
                          color: '#6b7280',
                          marginBottom: '4px',
                          wordBreak: 'break-word'
                        }}>
                          {notification.mensaje}
                        </div>
                      )}
                      <div style={{
                        fontSize: isMobile ? '10px' : '11px',
                        color: '#9ca3af'
                      }}>
                        {formatTimeAgo(notification.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: isMobile ? '8px' : '4px',
                        fontSize: isMobile ? '18px' : '16px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s',
                        flexShrink: 0,
                        minWidth: isMobile ? '32px' : 'auto',
                        height: isMobile ? '32px' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => !isMobile && (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => !isMobile && (e.currentTarget.style.opacity = 0.6)}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </div>
                  {!notification.leido && (
                    <div style={{
                      position: 'absolute',
                      left: '0',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '4px',
                      height: '60%',
                      background: '#3b82f6',
                      borderRadius: '0 2px 2px 0'
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Estilos de animación */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationSystem;