// src/services/firebaseservices.js
import { database } from '../config/firebase';
import { ref, set, get, onValue, push, update, remove } from 'firebase/database';
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
  // Escuchar cambios en tiempo real de zonas (LEGACY - para compatibilidad)
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

  // Escuchar cambios en tiempo real de zonas_asignadas (NUEVO)
  subscribeToZonasAsignadas: (callback) => {
    const zonasRef = ref(database, 'zonas_asignadas');
    const unsubscribe = onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📍 Zonas asignadas desde Firebase:', data); // Debug
      if (data) {
        const zonasArray = Object.entries(data).map(([id, zona]) => ({
          id,
          ...zona
        }));
        console.log('📍 Zonas procesadas:', zonasArray); // Debug
        callback(zonasArray);
      } else {
        console.log('⚠️ No hay zonas en zonas_asignadas');
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

  // Actualizar estado de zona
  updateZonaEstado: async (zonaId, estado, additionalData = {}) => {
    const zonaRef = ref(database, `zonas/${zonaId}`);
    await update(zonaRef, {
      estado,
      ...additionalData,
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
  },

  // Eliminar zona
  deleteZona: async (zonaId) => {
    const zonaRef = ref(database, `zonas/${zonaId}`);
    await remove(zonaRef);
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

  // Crear o actualizar trabajador (función para registro inicial)
  createOrUpdateTrabajador: async (trabajadorId, data) => {
    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    await set(trabajadorRef, {
      ...data,
      ultimaActualizacion: new Date().toISOString()
    });
  },

  // Actualizar datos generales del trabajador
  updateTrabajadorData: async (trabajadorId, data) => {
    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    await update(trabajadorRef, {
      ...data,
      ultimaActualizacion: new Date().toISOString()
    });
  },

  // Actualizar ubicación GPS del trabajador con historial
  updateTrabajadorLocation: async (trabajadorId, location) => {
    try {
      // Actualizar ubicación actual
      const ubicacionRef = ref(database, `trabajadores/${trabajadorId}/ubicacion`);
      await set(ubicacionRef, {
        lat: location.lat,
        lng: location.lng,
        timestamp: location.timestamp || new Date().toISOString()
      });
      
      // Guardar en historial de ubicaciones (opcional - útil para tracking)
      const historialRef = ref(database, `historial_ubicaciones/${trabajadorId}/${Date.now()}`);
      await set(historialRef, {
        lat: location.lat,
        lng: location.lng,
        timestamp: location.timestamp || new Date().toISOString()
      });

      console.log('✅ Ubicación actualizada en Firebase');
    } catch (error) {
      console.error('❌ Error al actualizar ubicación:', error);
      throw error;
    }
  },

  // Obtener trabajador por ID
  getTrabajadorById: (trabajadorId, callback) => {
    const trabajadorRef = ref(database, `trabajadores/${trabajadorId}`);
    const unsubscribe = onValue(trabajadorRef, (snapshot) => {
      const data = snapshot.val();
      callback(data ? { id: trabajadorId, ...data } : null);
    });
    return unsubscribe;
  },

  // Iniciar recorrido
  startRecorrido: async (trabajadorId, zonaData) => {
    const recorridoId = `${trabajadorId}_${Date.now()}`;
    const recorridoRef = ref(database, `recorridos/${recorridoId}`);
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
      recorridoActual: recorridoId
    });
    
    return recorridoId;
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
      estado: 'trabajando',
      horaLlegada: new Date().toISOString()
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
  },

  // Obtener todos los recorridos
  getAllRecorridos: (callback) => {
    const recorridosRef = ref(database, 'recorridos');
    const unsubscribe = onValue(recorridosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recorridos = Object.entries(data)
          .map(([id, recorrido]) => ({ id, ...recorrido }))
          .sort((a, b) => new Date(b.horaInicio) - new Date(a.horaInicio));
        callback(recorridos);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Limpiar historial de ubicaciones antiguas (más de 7 días)
  cleanOldLocationHistory: async () => {
    const historialRef = ref(database, 'historial_ubicaciones');
    const snapshot = await get(historialRef);
    const data = snapshot.val();
    
    if (data) {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const trabajadorId in data) {
        for (const timestamp in data[trabajadorId]) {
          if (parseInt(timestamp) < sevenDaysAgo) {
            const oldRef = ref(database, `historial_ubicaciones/${trabajadorId}/${timestamp}`);
            await remove(oldRef);
          }
        }
      }
    }
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
  },

  // Eliminar notificación
  deleteNotification: async (notificationId) => {
    const notifRef = ref(database, `notificaciones/${notificationId}`);
    await remove(notifRef);
  },

  // Eliminar todas las notificaciones de un usuario
  clearUserNotifications: async (userId) => {
    const notificacionesRef = ref(database, 'notificaciones');
    const snapshot = await get(notificacionesRef);
    const data = snapshot.val();
    
    if (data) {
      const toDelete = Object.entries(data)
        .filter(([id, notif]) => notif.destinatario === userId)
        .map(([id]) => id);
      
      for (const id of toDelete) {
        await remove(ref(database, `notificaciones/${id}`));
      }
    }
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

  // Obtener reporte por fecha
  getReportByDate: (fecha, callback) => {
    const reportRef = ref(database, `reportes/diarios/${fecha}`);
    const unsubscribe = onValue(reportRef, (snapshot) => {
      callback(snapshot.val());
    });
    return unsubscribe;
  },

  // Obtener reportes del mes
  getMonthlyReports: (year, month, callback) => {
    const reportesRef = ref(database, 'reportes/diarios');
    const unsubscribe = onValue(reportesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const monthReports = Object.entries(data)
          .filter(([fecha]) => {
            const [reportYear, reportMonth] = fecha.split('-');
            return reportYear === year.toString() && reportMonth === month.toString().padStart(2, '0');
          })
          .map(([fecha, report]) => ({ fecha, ...report }));
        callback(monthReports);
      } else {
        callback([]);
      }
    });
    return unsubscribe;
  },

  // Obtener estadísticas en tiempo real - VERSIÓN MEJORADA
  getRealtimeStats: (callback) => {
    console.log('📊 Iniciando servicio de estadísticas en tiempo real');
    
    const stats = {
      vehiculos: { total: 0, activos: 0, enMantenimiento: 0 },
      zonas: { total: 0, activas: 0, completadas: 0, pendientes: 0 },
      trabajadores: { total: 0, enRuta: 0, trabajando: 0, disponibles: 0 }
    };

    // Escuchar vehículos
    const vehiculosRef = ref(database, 'vehiculos');
    onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      console.log('🚛 Vehículos recibidos:', data);
      if (data) {
        const vehiculos = Object.values(data);
        stats.vehiculos.total = vehiculos.length;
        stats.vehiculos.enUso = vehiculos.filter(v => 
  v.estado === 'en_uso'  // ✅ Contar correctamente 'en_uso'
).length;

stats.vehiculos.activos = vehiculos.filter(v => 
  v.estado === 'disponible' || v.estado === 'en_uso'  // ✅ Activos = disponibles + en_uso
).length;
        stats.vehiculos.enMantenimiento = vehiculos.filter(v => 
          v.estado === 'mantenimiento'
        ).length;
      } else {
        stats.vehiculos = { total: 0, activos: 0, enMantenimiento: 0 };
      }
      callback({ ...stats });
    });

    // Escuchar zonas_asignadas
    const zonasRef = ref(database, 'zonas_asignadas');
    onValue(zonasRef, (snapshot) => {
      const data = snapshot.val();
      console.log('🏗️ Zonas asignadas recibidas:', data);
      if (data) {
        const zonas = Object.values(data);
        stats.zonas.total = zonas.length;
        stats.zonas.activas = zonas.filter(z => z.estado === 'en_progreso').length;
        stats.zonas.completadas = zonas.filter(z => z.estado === 'completado').length;
        stats.zonas.pendientes = zonas.filter(z => 
          z.estado === 'pendiente' || !z.estado
        ).length;
        console.log('📊 Estadísticas de zonas:', stats.zonas);
      } else {
        stats.zonas = { total: 0, activas: 0, completadas: 0, pendientes: 0 };
      }
      callback({ ...stats });
    });

    // Escuchar trabajadores
    const trabajadoresRef = ref(database, 'trabajadores');
    onValue(trabajadoresRef, (snapshot) => {
      const data = snapshot.val();
      console.log('👷 Trabajadores recibidos:', data);
      if (data) {
        const trabajadores = Object.values(data);
        stats.trabajadores.total = trabajadores.length;
        stats.trabajadores.enRuta = trabajadores.filter(t => t.estado === 'en_camino').length;
        stats.trabajadores.trabajando = trabajadores.filter(t => t.estado === 'trabajando').length;
        stats.trabajadores.disponibles = trabajadores.filter(t => 
          t.estado === 'disponible' || t.estado === 'activo' || !t.estado
        ).length;
        console.log('📊 Estadísticas de trabajadores:', stats.trabajadores);
      } else {
        stats.trabajadores = { total: 0, enRuta: 0, trabajando: 0, disponibles: 0 };
      }
      callback({ ...stats });
    });
  },
  // En vehiculosService, agregar:
getVehiculosDisponibles: (callback) => {
  const vehiculosRef = ref(database, 'vehiculos');
  const unsubscribe = onValue(vehiculosRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const vehiculosArray = Object.entries(data)
        .filter(([id, vehiculo]) => vehiculo.estado === 'disponible')
        .map(([id, vehiculo]) => ({
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

// Asignar vehículo a trabajador
assignVehiculoToTrabajador: async (vehiculoId, trabajadorId, trabajadorNombre) => {
  const vehiculoRef = ref(database, `vehiculos/${vehiculoId}`);
  await update(vehiculoRef, {
    estado: 'en_uso',
    asignadoA: trabajadorId,
    asignadoNombre: trabajadorNombre,
    fechaAsignacion: new Date().toISOString()
  });
},

// Liberar vehículo
releaseVehiculo: async (vehiculoId) => {
  const vehiculoRef = ref(database, `vehiculos/${vehiculoId}`);
  await update(vehiculoRef, {
    estado: 'disponible',
    asignadoA: null,
    asignadoNombre: null,
    destino: null,
    fechaAsignacion: null
  });
},

  // Generar reporte de productividad
  generateProductivityReport: async (startDate, endDate) => {
    const recorridosRef = ref(database, 'recorridos');
    const snapshot = await get(recorridosRef);
    const data = snapshot.val();
    
    if (data) {
      const recorridos = Object.values(data).filter(r => {
        const fecha = new Date(r.horaInicio);
        return fecha >= new Date(startDate) && fecha <= new Date(endDate);
      });
      
      // Calcular estadísticas
      const stats = {
        totalRecorridos: recorridos.length,
        recorridosCompletados: recorridos.filter(r => r.estado === 'completado').length,
        tiempoPromedioViaje: 0,
        tiempoPromedioTrabajo: 0,
        trabajadoresActivos: new Set(recorridos.map(r => r.trabajadorId)).size
      };
      
      // Calcular tiempos promedio
      const tiemposViaje = [];
      const tiemposTrabajo = [];
      
      recorridos.forEach(r => {
        if (r.horaLlegada && r.horaInicio) {
          const tiempoViaje = new Date(r.horaLlegada) - new Date(r.horaInicio);
          tiemposViaje.push(tiempoViaje);
        }
        if (r.horaFin && r.horaLlegada) {
          const tiempoTrabajo = new Date(r.horaFin) - new Date(r.horaLlegada);
          tiemposTrabajo.push(tiempoTrabajo);
        }
      });
      
      if (tiemposViaje.length > 0) {
        stats.tiempoPromedioViaje = tiemposViaje.reduce((a, b) => a + b, 0) / tiemposViaje.length;
      }
      if (tiemposTrabajo.length > 0) {
        stats.tiempoPromedioTrabajo = tiemposTrabajo.reduce((a, b) => a + b, 0) / tiemposTrabajo.length;
      }
      
      return stats;
    }
    
    return null;
  }
};

// ========== SERVICIO DE LIMPIEZA AUTOMÁTICA ==========

export const maintenanceService = {
  // Limpiar datos antiguos (ejecutar periódicamente)
  cleanOldData: async () => {
    try {
      // Limpiar historial de ubicaciones de más de 7 días
      await trabajadoresService.cleanOldLocationHistory();
      
      // Limpiar notificaciones leídas de más de 30 días
      const notificacionesRef = ref(database, 'notificaciones');
      const snapshot = await get(notificacionesRef);
      const data = snapshot.val();
      
      if (data) {
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
        
        for (const [id, notif] of Object.entries(data)) {
          if (notif.leido && new Date(notif.timestamp) < thirtyDaysAgo) {
            await remove(ref(database, `notificaciones/${id}`));
          }
        }
      }
      
      console.log('✅ Limpieza de datos antiguos completada');
    } catch (error) {
      console.error('❌ Error en limpieza de datos:', error);
    }
  }
};

