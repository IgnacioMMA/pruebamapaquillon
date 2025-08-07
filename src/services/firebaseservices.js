// src/services/firebaseservices.js
import { database } from '../config/firebase';
import { ref, set, onValue, push, update, remove } from 'firebase/database';

// ========== SERVICIOS PARA VEHÍCULOS ==========

export const vehiculosService = {
  // Escuchar cambios en tiempo real de vehículos
  subscribeToVehiculos: (callback) => {
    const vehiculosRef = ref(database, 'vehiculos');
    const unsubscribe = onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const vehiculosArray = Object.entries(data).map(([id, vehiculo]) => ({
          id,
          ...vehiculo
        }));
        callback(vehiculosArray);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Actualizar posición de vehículo
  updateVehiculoPosition: async (vehiculoId, position) => {
    const vehiculoRef = ref(database, `vehiculos/${vehiculoId}`);
    await update(vehiculoRef, {
      lat: position.lat,
      lng: position.lng,
      ultimaActualizacion: new Date().toISOString()
    });
  },

  // Actualizar estado de vehículo
  updateVehiculoEstado: async (vehiculoId, estado, additionalData = {}) => {
    const vehiculoRef = ref(database, `vehiculos/${vehiculoId}`);
    await update(vehiculoRef, {
      estado,
      ...additionalData,
      ultimaActualizacion: new Date().toISOString()
    });
  },

  // Crear nuevo vehículo
  createVehiculo: async (vehiculoData) => {
    const vehiculosRef = ref(database, 'vehiculos');
    const newVehiculoRef = push(vehiculosRef);
    await set(newVehiculoRef, {
      ...vehiculoData,
      createdAt: new Date().toISOString()
    });
    return newVehiculoRef.key;
  }
};

// ========== SERVICIOS PARA ZONAS ==========

export const zonasService = {
  // Escuchar cambios en tiempo real de zonas
  subscribeToZonas: (callback) => {
    const zonasRef = ref(database, 'zonas');
    const unsubscribe = onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const zonasArray = Object.entries(data).map(([id, zona]) => ({
          id,
          ...zona
        }));
        callback(zonasArray);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Actualizar progreso de zona
  updateZonaProgreso: async (zonaId, progreso) => {
    const zonaRef = ref(database, `zonas/${zonaId}`);
    await update(zonaRef, {
      progreso,
      estado: progreso === 100 ? 'completada' : 'activa',
      ultimaActualizacion: new Date().toISOString()
    });
  },

  // Crear nueva zona
  createZona: async (zonaData) => {
    const zonasRef = ref(database, 'zonas');
    const newZonaRef = push(zonasRef);
    await set(newZonaRef, {
      ...zonaData,
      createdAt: new Date().toISOString()
    });
    return newZonaRef.key;
  }
};

// ========== SERVICIOS PARA TRABAJADORES ==========

export const trabajadoresService = {
  // Escuchar cambios en tiempo real de trabajadores
  subscribeToTrabajadores: (callback) => {
    const trabajadoresRef = ref(database, 'trabajadores');
    const unsubscribe = onValue(trabajadoresRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const trabajadoresArray = Object.entries(data).map(([id, trabajador]) => ({
          id,
          ...trabajador
        }));
        callback(trabajadoresArray);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Actualizar ubicación GPS del trabajador
  updateTrabajadorLocation: async (trabajadorId, location) => {
    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}/ubicacion`);
    await set(trabajadorRef, {
      lat: location.lat,
      lng: location.lng,
      timestamp: new Date().toISOString()
    });
  },

  // Iniciar recorrido
  startRecorrido: async (trabajadorId, zonaData) => {
    const recorridoRef = ref(database, `recorridos/${trabajadorId}_${Date.now()}`);
    const recorridoData = {
      trabajadorId,
      zonaId: zonaData.id,
      zonaNombre: zonaData.nombre,
      zonaLat: zonaData.lat,
      zonaLng: zonaData.lng,
      horaInicio: new Date().toISOString(),
      estado: 'en_camino'
    };
    
    await set(recorridoRef, recorridoData);
    
    // Actualizar estado del trabajador
    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    await update(trabajadorRef, {
      estado: 'en_camino',
      zonaDestino: zonaData.nombre,
      recorridoActual: recorridoRef.key
    });
    
    return recorridoRef.key;
  },

  // Marcar llegada a zona
  markArrival: async (recorridoId, trabajadorId) => {
    const recorridoRef = ref(database, `recorridos/${recorridoId}`);
    await update(recorridoRef, {
      horaLlegada: new Date().toISOString(),
      estado: 'trabajando'
    });

    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    await update(trabajadorRef, {
      estado: 'trabajando'
    });
  },

  // Finalizar trabajo
  finishWork: async (recorridoId, trabajadorId) => {
    const recorridoRef = ref(database, `recorridos/${recorridoId}`);
    await update(recorridoRef, {
      horaFin: new Date().toISOString(),
      estado: 'completado'
    });

    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    await update(trabajadorRef, {
      estado: 'disponible',
      zonaDestino: null,
      recorridoActual: null
    });
  },

  // Obtener historial de recorridos
  getRecorridosHistory: (trabajadorId, callback) => {
    const recorridosRef = ref(database, 'recorridos');
    const unsubscribe = onValue(recorridosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recorridos = Object.entries(data)
          .filter(([id, recorrido]) => recorrido.trabajadorId === trabajadorId)
          .map(([id, recorrido]) => ({ id, ...recorrido }))
          .sort((a, b) => new Date(b.horaInicio) - new Date(a.horaInicio));
        callback(recorridos);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  }
};

// ========== SERVICIOS DE NOTIFICACIONES ==========

export const notificacionesService = {
  // Enviar notificación
  sendNotification: async (notificationData) => {
    const notificacionesRef = ref(database, 'notificaciones');
    const newNotifRef = push(notificacionesRef);
    await set(newNotifRef, {
      ...notificationData,
      timestamp: new Date().toISOString(),
      leido: false
    });
    return newNotifRef.key;
  },

  // Escuchar notificaciones para un usuario
  subscribeToNotifications: (userId, callback) => {
    const notificacionesRef = ref(database, 'notificaciones');
    const unsubscribe = onValue(notificacionesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const notificaciones = Object.entries(data)
          .filter(([id, notif]) => notif.destinatario === userId)
          .map(([id, notif]) => ({ id, ...notif }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        callback(notificaciones);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Marcar notificación como leída
  markAsRead: async (notificationId) => {
    const notifRef = ref(database, `notificaciones/${notificationId}`);
    await update(notifRef, { leido: true });
  }
};

// ========== SERVICIOS DE REPORTES ==========

export const reportesService = {
  // Guardar reporte diario
  saveDailyReport: async (reportData) => {
    const fecha = new Date().toISOString().split('T')[0];
    const reportRef = ref(database, `reportes/diarios/${fecha}`);
    await set(reportRef, {
      ...reportData,
      fecha,
      timestamp: new Date().toISOString()
    });
  },

  // Obtener estadísticas en tiempo real
  getRealtimeStats: (callback) => {
    const refs = {
      vehiculos: ref(database, 'vehiculos'),
      zonas: ref(database, 'zonas'),
      trabajadores: ref(database, 'trabajadores')
    };

    const stats = {
      vehiculos: { total: 0, activos: 0, enMantenimiento: 0 },
      zonas: { total: 0, activas: 0, completadas: 0 },
      trabajadores: { total: 0, enRuta: 0, trabajando: 0 }
    };

    // Escuchar vehículos
    onValue(refs.vehiculos, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const vehiculos = Object.values(data);
        stats.vehiculos.total = vehiculos.length;
        stats.vehiculos.activos = vehiculos.filter(v => v.estado === 'activo' || v.estado === 'en_ruta').length;
        stats.vehiculos.enMantenimiento = vehiculos.filter(v => v.estado === 'mantenimiento').length;
      }
      callback(stats);
    });

    // Escuchar zonas
    onValue(refs.zonas, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const zonas = Object.values(data);
        stats.zonas.total = zonas.length;
        stats.zonas.activas = zonas.filter(z => z.estado === 'activa').length;
        stats.zonas.completadas = zonas.filter(z => z.estado === 'completada').length;
      }
      callback(stats);
    });

    // Escuchar trabajadores
    onValue(refs.trabajadores, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const trabajadores = Object.values(data);
        stats.trabajadores.total = trabajadores.length;
        stats.trabajadores.enRuta = trabajadores.filter(t => t.estado === 'en_camino').length;
        stats.trabajadores.trabajando = trabajadores.filter(t => t.estado === 'trabajando').length;
      }
      callback(stats);
    });
  }
};