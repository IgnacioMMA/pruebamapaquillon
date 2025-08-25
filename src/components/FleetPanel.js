// src/components/FleetPanel.js
import React, { useState, useEffect } from 'react';
import { database, firestore } from '../config/firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import NotificationSystem, { createNotification } from './NotificationSystem';

const FleetPanel = ({ currentUser, onLogout, onViewChange, currentView = 'fleet' }) => {
  const [vehiculos, setVehiculos] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('vehicles');
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [isMobile, setIsMobile] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [quickEditMode, setQuickEditMode] = useState({}); // Para edición rápida de operador
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  // NUEVO: Estados para documentos
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState(null);
  const [documentOwner, setDocumentOwner] = useState(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  // Agregar estos estados después de los existentes
  const [showWorkerDetailModal, setShowWorkerDetailModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [updatingLicense, setUpdatingLicense] = useState(false);

  // Detectar si es móvil - MEJORADO
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar datos
  useEffect(() => {
    loadVehiculos();
    loadTrabajadores();
    loadUsers();
  }, []);
  const loadVehiculos = () => {
    const vehiculosRef = ref(database, 'vehiculos');
    const unsubscribe = onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const vehiculosArray = Object.entries(data).map(([id, vehiculo]) => ({
          id,
          ...vehiculo
        }));
        setVehiculos(vehiculosArray);
      } else {
        setVehiculos([]);
      }
    });
    return unsubscribe;
  };
  const loadTrabajadores = () => {
    const trabajadoresRef = ref(database, 'trabajadores');
    const unsubscribe = onValue(trabajadoresRef, async (snapshot) => {
      const data = snapshot.val();

      // Obtener trabajadores de Realtime Database
      const trabajadoresDB = data ? Object.entries(data).map(([id, trabajador]) => ({
        id,
        ...trabajador,
        source: 'database'
      })) : [];

      // Obtener TODOS los usuarios de Firestore (no solo trabajadores)
      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const todosLosUsuarios = [];

        usersSnapshot.forEach((doc) => {
          const userData = doc.data();

          // Buscar si existe en trabajadoresDB
          const existeEnDB = trabajadoresDB.find(t => t.id === doc.id);

          if (!existeEnDB) {
            // Si no existe en Realtime Database, agregarlo desde Firestore
            todosLosUsuarios.push({
              id: doc.id,
              nombre: userData.name || 'Sin nombre',
              email: userData.email,
              telefono: userData.phone || '',
              role: userData.role || 'trabajador', // IMPORTANTE: mantener el rol
              vehiculoAsignado: userData.vehicleId || null,
              estado: 'disponible',
              licenciaConducir: userData.licenciaConducir || '',
              licenciasConducir: userData.licenciasConducir || [],
              fechaVencimientoLicencia: userData.fechaVencimientoLicencia || '',
              observacionesLicencia: userData.observacionesLicencia || '',
              licenciaBloqueada: userData.licenciaBloqueada || false,
              rut: userData.rut || '',
              localidad: userData.localidad || '',
              source: 'firestore'
            });
          } else {
            // Si existe, actualizar con datos de Firestore que puedan faltar
            const index = trabajadoresDB.findIndex(t => t.id === doc.id);
            if (index !== -1) {
              trabajadoresDB[index] = {
                ...trabajadoresDB[index],
                nombre: trabajadoresDB[index].nombre || userData.name,
                email: userData.email,
                telefono: trabajadoresDB[index].telefono || userData.phone,
                role: userData.role || 'trabajador', // Asegurar que tenga rol
                licenciaConducir: userData.licenciaConducir || trabajadoresDB[index].licenciaConducir,
                licenciasConducir: userData.licenciasConducir || trabajadoresDB[index].licenciasConducir,
                fechaVencimientoLicencia: userData.fechaVencimientoLicencia || trabajadoresDB[index].fechaVencimientoLicencia,
                observacionesLicencia: userData.observacionesLicencia || trabajadoresDB[index].observacionesLicencia,
                licenciaBloqueada: userData.licenciaBloqueada !== undefined ? userData.licenciaBloqueada : trabajadoresDB[index].licenciaBloqueada,
                rut: userData.rut || trabajadoresDB[index].rut,
                localidad: userData.localidad || trabajadoresDB[index].localidad
              };
            }
          }
        });

        // Combinar ambas fuentes
        const todosLosTrabajadores = [...trabajadoresDB, ...todosLosUsuarios];

        // Eliminar duplicados
        const trabajadoresUnicos = todosLosTrabajadores.reduce((acc, current) => {
          const x = acc.find(item => item.id === current.id);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);

        console.log(`📊 Total usuarios encontrados: ${trabajadoresUnicos.length}`);
        console.log(`  - Trabajadores: ${trabajadoresUnicos.filter(u => u.role === 'trabajador').length}`);
        console.log(`  - Administradores: ${trabajadoresUnicos.filter(u => u.role === 'admin').length}`);
        console.log(`  - Super Admins: ${trabajadoresUnicos.filter(u => u.role === 'superadmin').length}`);

        setTrabajadores(trabajadoresUnicos);

      } catch (error) {
        console.error('Error al cargar usuarios de Firestore:', error);
        setTrabajadores(trabajadoresDB);
      }
    });

    return unsubscribe;
  };

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

  // NUEVA FUNCIÓN: Cargar documentos de vehículo
  const loadVehicleDocuments = async (vehiculoId, vehicleData) => {
    setLoadingDocuments(true);
    try {
      // Buscar documentos en diferentes rutas posibles
      const rutas = [
        `vehiculos/${vehiculoId}/documentos`,
        `documentos/vehiculos/${vehiculoId}`,
        `documentos_vehiculos/${vehiculoId}`
      ];

      let documentosEncontrados = null;

      for (const ruta of rutas) {
        const docsRef = ref(database, ruta);
        const snapshot = await get(docsRef);
        const data = snapshot.val();

        if (data && Object.keys(data).length > 0) {
          documentosEncontrados = data;
          console.log(`📄 Documentos de vehículo encontrados en: ${ruta}`);
          break;
        }
      }

      // Verificar si hay documentos dentro del objeto del vehículo
      if (!documentosEncontrados && vehicleData?.documentos) {
        documentosEncontrados = vehicleData.documentos;
        console.log('📄 Documentos encontrados dentro del objeto vehículo');
      }

      // Pasar todos los documentos encontrados tal como están
      setSelectedDocuments(documentosEncontrados || {});

      setDocumentOwner({
        type: 'vehicle',
        id: vehiculoId,
        name: vehicleData.nombre || 'Vehículo'
      });

      setShowDocumentsModal(true);
    } catch (error) {
      console.error('Error al cargar documentos del vehículo:', error);
      setMessage({ type: 'error', text: '❌ Error al cargar documentos' });
    } finally {
      setLoadingDocuments(false);
    }
    // Cuando se suben documentos exitosamente
    await createNotification(currentUser.uid, {
      tipo: 'documento_subido',
      titulo: 'Documentos cargados',
      mensaje: `Se cargaron los documentos del vehículo ${vehicleData.nombre}`
    });
  };

  // NUEVA FUNCIÓN: Cargar documentos de trabajador
  const loadWorkerDocuments = async (trabajadorId, workerData) => {
    setLoadingDocuments(true);
    try {
      // Buscar documentos en diferentes rutas posibles
      const rutas = [
        `trabajadores/${trabajadorId}/documentos`,
        `documentos/${trabajadorId}`,
        `usuarios/${trabajadorId}/documentos`
      ];

      let documentosEncontrados = null;

      for (const ruta of rutas) {
        const docsRef = ref(database, ruta);
        const snapshot = await get(docsRef);
        const data = snapshot.val();

        if (data && Object.keys(data).length > 0) {
          documentosEncontrados = data;
          console.log(`📄 Documentos de trabajador encontrados en: ${ruta}`);
          break;
        }
      }

      // Verificar si hay documentos dentro del objeto del trabajador
      if (!documentosEncontrados && workerData?.documentos) {
        documentosEncontrados = workerData.documentos;
        console.log('📄 Documentos encontrados dentro del objeto trabajador');
      }

      if (documentosEncontrados) {
        // Procesar certificados si existen
        let certificadosProcesados = [];
        if (documentosEncontrados.certificados && typeof documentosEncontrados.certificados === 'object') {
          certificadosProcesados = Object.entries(documentosEncontrados.certificados).map(([key, cert]) => ({
            firebaseKey: key,
            ...cert
          }));
        }

        setSelectedDocuments({
          licenciaConducir: documentosEncontrados.licenciaConducir || null,
          certificadoOperador: documentosEncontrados.certificadoOperador || null,
          certificados: certificadosProcesados
        });
      } else {
        setSelectedDocuments({
          licenciaConducir: null,
          certificadoOperador: null,
          certificados: []
        });
      }

      setDocumentOwner({
        type: 'worker',
        id: trabajadorId,
        name: workerData.nombre || 'Trabajador'
      });

      setShowDocumentsModal(true);
    } catch (error) {
      console.error('Error al cargar documentos del trabajador:', error);
      setMessage({ type: 'error', text: '❌ Error al cargar documentos' });
    } finally {
      setLoadingDocuments(false);
    }
  };
  // Función para verificar vencimientos (ejecutar cada día)
  const checkExpirations = async () => {
    const hoy = new Date();

    // Verificar licencias de trabajadores
    trabajadores.forEach(async (trabajador) => {
      if (trabajador.fechaVencimientoLicencia) {
        const fechaVencimiento = new Date(trabajador.fechaVencimientoLicencia);
        const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

        if (diasRestantes === 14 || diasRestantes === 7 || diasRestantes === 1) {
          await createNotification(currentUser.uid, {
            tipo: 'licencia_proxima',
            titulo: `⚠️ Licencia próxima a vencer`,
            mensaje: `La licencia de ${trabajador.nombre} vence en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`
          });
        } else if (diasRestantes === 0) {
          await createNotification(currentUser.uid, {
            tipo: 'licencia_vencida',
            titulo: `🚫 Licencia vencida`,
            mensaje: `La licencia de ${trabajador.nombre} venció hoy`
          });
        }
      }
    });

    // Verificar documentos de vehículos
    vehiculos.forEach(async (vehiculo) => {
      if (vehiculo.fechaRevisionTecnica) {
        const fechaRevision = new Date(vehiculo.fechaRevisionTecnica);
        const diasRestantes = Math.ceil((fechaRevision - hoy) / (1000 * 60 * 60 * 24));

        if (diasRestantes <= 7 && diasRestantes > 0) {
          await createNotification(currentUser.uid, {
            tipo: 'documento_vencido',
            titulo: `📄 Revisión técnica próxima a vencer`,
            mensaje: `La revisión técnica de ${vehiculo.nombre} vence en ${diasRestantes} días`
          });
        }
      }
    });
  };

  // Ejecutar al cargar y cada 24 horas
  useEffect(() => {
    checkExpirations();
    const interval = setInterval(checkExpirations, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [trabajadores, vehiculos]);

  // Función para formatear tamaño de archivo
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const quickUpdateOperator = async (vehiculoId, nuevoOperadorId) => {
    setLoading(true);

    try {
      // Definir las variables al inicio del try para que estén disponibles en todo el scope
      const vehiculo = vehiculos.find(v => v.id === vehiculoId);
      const trabajador = nuevoOperadorId ? trabajadores.find(t => t.id === nuevoOperadorId) : null;

      // NUEVA VALIDACIÓN: Verificar licencias requeridas
      if (nuevoOperadorId) {
        if (vehiculo?.licenciasRequeridas && vehiculo.licenciasRequeridas.length > 0) {
          const licenciasTrabajador = trabajador?.licenciasConducir || [];
          const tieneAlgunaLicenciaRequerida = vehiculo.licenciasRequeridas.some(
            licRequerida => licenciasTrabajador.includes(licRequerida)
          );

          if (!tieneAlgunaLicenciaRequerida) {
            // Mostrar mensaje detallado de error
            const licenciasRequeridas = vehiculo.licenciasRequeridas.join(', ');
            const licenciasTrabajadorStr = licenciasTrabajador.length > 0
              ? licenciasTrabajador.join(', ')
              : 'ninguna';

            setMessage({
              type: 'error',
              text: `❌ No se puede asignar. El vehículo requiere licencia clase: ${licenciasRequeridas}. El trabajador tiene: ${licenciasTrabajadorStr}`
            });
            setLoading(false);
            return;
          }
        }

        // Verificar si el trabajador tiene licencia bloqueada
        if (trabajador?.licenciaBloqueada) {
          setMessage({
            type: 'error',
            text: '❌ No se puede asignar. El trabajador tiene la licencia bloqueada.'
          });
          setLoading(false);
          return;
        }
      }

      // Actualizar en Realtime Database
      const vehiculoRef = ref(database, `vehiculos/${vehiculoId}`);
      await update(vehiculoRef, {
        operadorAsignado: nuevoOperadorId || null,
        ultimaActualizacion: new Date().toISOString(),
        actualizadoPor: currentUser.uid
      });

      // Si se asignó un trabajador, actualizar su información también
      if (nuevoOperadorId) {
        const userRef = doc(firestore, 'users', nuevoOperadorId);
        await updateDoc(userRef, {
          vehicleId: vehiculoId,
          updatedAt: new Date().toISOString()
        });

        // Actualizar en trabajadores
        const trabajadorRef = ref(database, `trabajadores/${nuevoOperadorId}`);
        await update(trabajadorRef, {
          vehiculoAsignado: vehiculoId,
          ultimaActualizacion: new Date().toISOString()
        });
      }

      // Limpiar vehículo anterior si otro trabajador lo tenía
      if (nuevoOperadorId) {
        vehiculos.forEach(async (v) => {
          if (v.id !== vehiculoId && v.operadorAsignado === nuevoOperadorId) {
            const otroVehiculoRef = ref(database, `vehiculos/${v.id}`);
            await update(otroVehiculoRef, {
              operadorAsignado: null,
              ultimaActualizacion: new Date().toISOString()
            });
          }
        });
      }

      // NOTIFICACIONES - Ahora las variables están disponibles
      if (typeof createNotification === 'function') {
        // Notificación para el administrador
        await createNotification(currentUser.uid, {
          tipo: 'vehiculo_asignado',
          titulo: `Operador actualizado en ${vehiculo?.nombre || 'Vehículo'}`,
          mensaje: nuevoOperadorId && trabajador
            ? `${trabajador.nombre} fue asignado como operador`
            : 'Se removió el operador del vehículo'
        });

        // Notificar al trabajador si fue asignado
        if (nuevoOperadorId && trabajador) {
          await createNotification(nuevoOperadorId, {
            tipo: 'vehiculo_asignado',
            titulo: 'Te han asignado un vehículo',
            mensaje: `Has sido asignado como operador del vehículo ${vehiculo?.nombre || ''}`
          });
        }
      }

      setMessage({ type: 'success', text: '✅ Operador actualizado exitosamente' });
      setQuickEditMode({ ...quickEditMode, [vehiculoId]: false });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error al actualizar operador' });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de edición
  const openEditModal = (item, type) => {
    if (type === 'vehicle') {
      setEditFormData({
        nombre: item.nombre || '',
        patente: item.patente || '',
        kilometraje: item.kilometraje || 0,
        operadorAsignado: item.operadorAsignado || '',
        observaciones: item.observaciones || '',
        estado: item.estado || 'disponible'
      });
    } else if (type === 'worker') {
      const userData = users.find(u => u.id === item.id);
      setEditFormData({
        nombre: item.nombre || userData?.name || '',
        email: userData?.email || '',
        telefono: userData?.phone || item.telefono || '',
        vehicleId: userData?.vehicleId || '',
        estado: item.estado || 'disponible'
      });
    }
    setEditingItem({ ...item, type });
    setShowEditModal(true);
  };

  // Guardar cambios de vehículo
  const saveVehicleChanges = async () => {
    if (!editingItem) return;

    setLoading(true);
    try {
      const vehicleRef = ref(database, `vehiculos/${editingItem.id}`);
      await update(vehicleRef, {
        ...editFormData,
        ultimaActualizacion: new Date().toISOString(),
        actualizadoPor: currentUser.uid
      });

      setMessage({ type: 'success', text: '✅ Vehículo actualizado exitosamente' });
      setShowEditModal(false);
      setEditingItem(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error al actualizar vehículo' });
    } finally {
      setLoading(false);
    }
  };

  // Guardar cambios de trabajador
  const saveWorkerChanges = async () => {
    if (!editingItem) return;

    setLoading(true);
    try {
      // Actualizar en Realtime Database
      const trabajadorRef = ref(database, `trabajadores/${editingItem.id}`);
      await update(trabajadorRef, {
        nombre: editFormData.nombre,
        telefono: editFormData.telefono,
        estado: editFormData.estado,
        ultimaActualizacion: new Date().toISOString()
      });

      // Actualizar en Firestore
      const userRef = doc(firestore, 'users', editingItem.id);
      await updateDoc(userRef, {
        name: editFormData.nombre,
        phone: editFormData.telefono,
        vehicleId: editFormData.vehicleId || null,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
      });

      setMessage({ type: 'success', text: '✅ Trabajador actualizado exitosamente' });
      setShowEditModal(false);
      setEditingItem(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '❌ Error al actualizar trabajador' });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar vehículos
  const filteredVehiculos = vehiculos.filter(v => {
    const matchesSearch = v.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.patente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.marca?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'todos' || v.estado === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Filtrar trabajadores
  const filteredTrabajadores = trabajadores.filter(t => {
    const matchesSearch =
      t.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.telefono?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'todos' ||
      (t.estado && t.estado === filterStatus) ||
      (filterStatus === 'disponible' && !t.estado); // Si no tiene estado, considerarlo disponible

    return matchesSearch && matchesFilter;
  });
  const trabajadoresReales = filteredTrabajadores.filter(t =>
    !t.role || t.role === 'trabajador'
  );
  const administradores = filteredTrabajadores.filter(t =>
    t.role === 'admin'
  );
  const superAdmins = filteredTrabajadores.filter(t =>
    t.role === 'superadmin'
  );

  // Obtener estadísticas
  const getStats = () => {
    const vehicleStats = {
      total: vehiculos.length,
      disponibles: vehiculos.filter(v => v.estado === 'disponible').length,
      enUso: vehiculos.filter(v => v.estado === 'en_uso').length,
      mantenimiento: vehiculos.filter(v => v.estado === 'mantenimiento').length
    };

    const workerStats = {
      total: trabajadores.length,
      trabajadores: trabajadores.filter(t => !t.role || t.role === 'trabajador').length,
      administradores: trabajadores.filter(t => t.role === 'admin').length,
      superadmins: trabajadores.filter(t => t.role === 'superadmin').length,
      activos: trabajadores.filter(t => t.ubicacion &&
        (new Date() - new Date(t.ubicacion.timestamp)) < 300000).length,
      enRuta: trabajadores.filter(t => t.estado === 'en_camino').length,
      trabajando: trabajadores.filter(t => t.estado === 'trabajando').length,
      disponibles: trabajadores.filter(t => t.estado === 'disponible' || !t.estado).length
    };

    return { vehicleStats, workerStats };
  };

  const { vehicleStats, workerStats } = getStats();

  // Toggle expandir/contraer tarjeta
  const toggleCardExpansion = (id) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // NUEVO: Modal de Documentos
  const DocumentsModal = () => {
    if (!showDocumentsModal || !selectedDocuments || !documentOwner) return null;

    const isVehicle = documentOwner.type === 'vehicle';

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'flex-start' : 'center',
        zIndex: 3000,
        padding: isMobile ? '10px' : '20px',
        overflowY: 'auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: isMobile ? '100%' : '900px',
          width: '100%',
          maxHeight: isMobile ? 'none' : '90vh',
          height: isMobile ? 'auto' : 'auto',
          overflow: 'auto',
          padding: isMobile ? '20px' : '30px',
          marginTop: isMobile ? '20px' : '0',
          marginBottom: isMobile ? '20px' : '0'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <h2 style={{
              margin: 0,
              color: '#1f2937',
              fontSize: isMobile ? '20px' : '24px',
              flex: 1
            }}>
              📄 Documentos de {documentOwner.name}
            </h2>
            <button
              onClick={() => {
                setShowDocumentsModal(false);
                setSelectedDocuments(null);
                setDocumentOwner(null);
              }}
              style={{
                padding: '8px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px',
                minWidth: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✖
            </button>
          </div>

          {loadingDocuments ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              <div>Cargando documentos...</div>
            </div>
          ) : (
            <>
              {isVehicle ? (
                // Documentos de Vehículo - MOSTRAR TODOS LOS DOCUMENTOS
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px'
                  }}>
                    {/* Mapear todos los documentos del vehículo */}
                    {Object.entries(selectedDocuments).map(([key, documento]) => {
                      // Saltar el array de "otros" ya que lo procesaremos después
                      if (key === 'otros' || !documento || typeof documento !== 'object') return null;

                      // Determinar el icono y nombre del documento
                      const getDocumentInfo = (docKey) => {
                        const docTypes = {
                          permisoCirculacion: { icon: '📋', name: 'Permiso de Circulación' },
                          revisionTecnica: { icon: '🔧', name: 'Revisión Técnica' },
                          seguroObligatorio: { icon: '🛡️', name: 'Seguro Obligatorio' },
                          soap: { icon: '🛡️', name: 'SOAP' },
                          padronMunicipal: { icon: '🏛️', name: 'Padrón Municipal' },
                          certificadoGases: { icon: '💨', name: 'Certificado de Gases' },
                          seguroComplementario: { icon: '🔒', name: 'Seguro Complementario' },
                          certificadoRevision: { icon: '📝', name: 'Certificado de Revisión' },
                          permisoTransporte: { icon: '🚛', name: 'Permiso de Transporte' },
                          certificadoOperatividad: { icon: '✅', name: 'Certificado de Operatividad' }
                        };

                        return docTypes[docKey] || {
                          icon: '📄',
                          name: docKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                        };
                      };

                      const docInfo = getDocumentInfo(key);

                      return (
                        <div key={key} style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '15px',
                          background: documento?.url ? '#f0fdf4' : 'white'
                        }}>
                          <h5 style={{
                            margin: '0 0 10px 0',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            {docInfo.icon} {docInfo.name}
                          </h5>
                          {documento?.url ? (
                            <div>
                              <div style={{
                                padding: '8px',
                                background: '#f9fafb',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                fontSize: '12px'
                              }}>
                                <div style={{
                                  fontWeight: '500',
                                  color: '#1f2937',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {documento.nombre || 'Documento'}
                                </div>
                                {documento.fecha && (
                                  <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                                    {new Date(documento.fecha).toLocaleDateString('es-CL')}
                                  </div>
                                )}
                                {documento.tamaño > 0 && (
                                  <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                                    {formatFileSize(documento.tamaño)}
                                  </div>
                                )}
                              </div>
                              <a
                                href={documento.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'block',
                                  padding: '6px',
                                  background: '#3b82f6',
                                  color: 'white',
                                  textAlign: 'center',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontSize: '12px'
                                }}
                              >
                                👁️ Ver Documento
                              </a>
                            </div>
                          ) : (
                            <div style={{
                              padding: '20px',
                              background: '#f9fafb',
                              borderRadius: '6px',
                              textAlign: 'center',
                              color: '#6b7280',
                              fontSize: '12px'
                            }}>
                              Sin documento
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Documentos adicionales si existen */}
                  {selectedDocuments.otros && selectedDocuments.otros.length > 0 && (
                    <div style={{
                      marginTop: '30px',
                      padding: '20px',
                      background: '#f9fafb',
                      borderRadius: '8px'
                    }}>
                      <h5 style={{
                        margin: '0 0 15px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        📚 Otros Documentos
                      </h5>
                      <div>
                        {selectedDocuments.otros.map((doc, index) => (
                          <div key={index} style={{
                            padding: '10px',
                            background: 'white',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '13px',
                                color: '#1f2937'
                              }}>
                                📜 {doc.nombre || 'Documento adicional'}
                              </div>
                              <div style={{
                                color: '#6b7280',
                                fontSize: '11px',
                                marginTop: '2px'
                              }}>
                                {doc.tamaño && formatFileSize(doc.tamaño)}
                                {doc.fecha && ` • ${new Date(doc.fecha).toLocaleDateString('es-CL')}`}
                              </div>
                            </div>
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 8px',
                                background: '#3b82f6',
                                color: 'white',
                                borderRadius: '4px',
                                textDecoration: 'none',
                                fontSize: '11px',
                                marginLeft: '10px'
                              }}
                            >
                              Ver
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Documentos de Trabajador
                <div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                  }}>
                    {/* Licencia de Conducir */}
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '15px',
                      background: selectedDocuments.licenciaConducir?.url ? '#f0fdf4' : 'white'
                    }}>
                      <h5 style={{
                        margin: '0 0 10px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        🚗 Licencia de Conducir
                      </h5>
                      {selectedDocuments.licenciaConducir?.url ? (
                        <div>
                          <div style={{
                            padding: '8px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '12px'
                          }}>
                            <div style={{ fontWeight: '500', color: '#1f2937' }}>
                              {selectedDocuments.licenciaConducir.nombre || 'Documento'}
                            </div>
                            {selectedDocuments.licenciaConducir.fecha && (
                              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                                {new Date(selectedDocuments.licenciaConducir.fecha).toLocaleDateString('es-CL')}
                              </div>
                            )}
                            {selectedDocuments.licenciaConducir.tamaño > 0 && (
                              <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                                {formatFileSize(selectedDocuments.licenciaConducir.tamaño)}
                              </div>
                            )}
                          </div>
                          <a
                            href={selectedDocuments.licenciaConducir.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              padding: '6px',
                              background: '#3b82f6',
                              color: 'white',
                              textAlign: 'center',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '12px'
                            }}
                          >
                            👁️ Ver Documento
                          </a>
                        </div>
                      ) : (
                        <div style={{
                          padding: '20px',
                          background: '#f9fafb',
                          borderRadius: '6px',
                          textAlign: 'center',
                          color: '#6b7280',
                          fontSize: '12px'
                        }}>
                          Sin documento
                        </div>
                      )}
                    </div>

                    {/* Certificado de Operador */}
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '15px',
                      background: selectedDocuments.certificadoOperador?.url ? '#f0fdf4' : 'white'
                    }}>
                      <h5 style={{
                        margin: '0 0 10px 0',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        🏗️ Certificado de Operador
                      </h5>
                      {selectedDocuments.certificadoOperador?.url ? (
                        <div>
                          <div style={{
                            padding: '8px',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            fontSize: '12px'
                          }}>
                            <div style={{ fontWeight: '500', color: '#1f2937' }}>
                              {selectedDocuments.certificadoOperador.nombre || 'Documento'}
                            </div>
                            {selectedDocuments.certificadoOperador.fecha && (
                              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                                {new Date(selectedDocuments.certificadoOperador.fecha).toLocaleDateString('es-CL')}
                              </div>
                            )}
                            {selectedDocuments.certificadoOperador.tamaño > 0 && (
                              <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                                {formatFileSize(selectedDocuments.certificadoOperador.tamaño)}
                              </div>
                            )}
                          </div>
                          <a
                            href={selectedDocuments.certificadoOperador.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'block',
                              padding: '6px',
                              background: '#3b82f6',
                              color: 'white',
                              textAlign: 'center',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '12px'
                            }}
                          >
                            👁️ Ver Documento
                          </a>
                        </div>
                      ) : (
                        <div style={{
                          padding: '20px',
                          background: '#f9fafb',
                          borderRadius: '6px',
                          textAlign: 'center',
                          color: '#6b7280',
                          fontSize: '12px'
                        }}>
                          Sin documento
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Certificados Adicionales */}
                  {selectedDocuments.certificados && selectedDocuments.certificados.length > 0 && (
                    <div style={{
                      padding: '20px',
                      background: '#f9fafb',
                      borderRadius: '8px'
                    }}>
                      <h5 style={{
                        margin: '0 0 15px 0',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#374151'
                      }}>
                        📚 Certificados de Capacitación
                      </h5>
                      <div>
                        {selectedDocuments.certificados.map((cert, index) => (
                          <div key={index} style={{
                            padding: '10px',
                            background: 'white',
                            borderRadius: '6px',
                            marginBottom: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: '500',
                                fontSize: '13px',
                                color: '#1f2937'
                              }}>
                                📜 {cert.nombre || 'Certificado'}
                              </div>
                              <div style={{
                                color: '#6b7280',
                                fontSize: '11px',
                                marginTop: '2px'
                              }}>
                                {cert.tamaño && formatFileSize(cert.tamaño)}
                                {cert.fecha && ` • ${new Date(cert.fecha).toLocaleDateString('es-CL')}`}
                              </div>
                            </div>
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 8px',
                                background: '#3b82f6',
                                color: 'white',
                                borderRadius: '4px',
                                textDecoration: 'none',
                                fontSize: '11px',
                                marginLeft: '10px'
                              }}
                            >
                              Ver
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mensaje si no hay documentos */}
              {isVehicle ? (
                Object.keys(selectedDocuments).length === 0 && (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    marginTop: '20px'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
                    <p>No hay documentos registrados para este vehículo</p>
                  </div>
                )
              ) : (
                !selectedDocuments.licenciaConducir?.url &&
                !selectedDocuments.certificadoOperador?.url &&
                selectedDocuments.certificados?.length === 0 && (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: '8px'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📭</div>
                    <p>No hay documentos registrados para este trabajador</p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  // Agregar este componente antes del return principal
  const WorkerDetailModal = () => {
    if (!showWorkerDetailModal || !selectedWorker) return null;

    const userData = users.find(u => u.id === selectedWorker.id);
    const vehiculo = vehiculos.find(v => v.operadorAsignado === selectedWorker.id);

    // Calcular estado de licencia
    let estadoLicencia = null;
    if (selectedWorker.fechaVencimientoLicencia && selectedWorker.licenciasConducir?.length > 0) {
      const fechaVencimiento = new Date(selectedWorker.fechaVencimientoLicencia);
      const hoy = new Date();
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

      if (diasRestantes < 0) {
        estadoLicencia = { tipo: 'vencida', texto: 'VENCIDA', color: '#ef4444', dias: diasRestantes };
      } else if (diasRestantes <= 14) {
        estadoLicencia = { tipo: 'porVencer', texto: `${diasRestantes} días`, color: '#f59e0b', dias: diasRestantes };
      } else {
        estadoLicencia = { tipo: 'vigente', texto: 'Vigente', color: '#22c55e', dias: diasRestantes };
      }
    }

    const handleToggleLicenseBlock = async () => {
      setUpdatingLicense(true);
      try {
        const nuevoEstadoBloqueo = !selectedWorker.licenciaBloqueada;

        // Actualizar en Firestore
        const userRef = doc(firestore, 'users', selectedWorker.id);
        await updateDoc(userRef, {
          licenciaBloqueada: nuevoEstadoBloqueo,
          motivoBloqueo: nuevoEstadoBloqueo ? 'Bloqueado por administrador' : '',
          fechaBloqueo: nuevoEstadoBloqueo ? new Date().toISOString() : '',
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid
        });

        // Actualizar en Realtime Database
        const trabajadorRef = ref(database, `trabajadores/${selectedWorker.id}`);
        await update(trabajadorRef, {
          licenciaBloqueada: nuevoEstadoBloqueo,
          motivoBloqueo: nuevoEstadoBloqueo ? 'Bloqueado por administrador' : '',
          fechaBloqueo: nuevoEstadoBloqueo ? new Date().toISOString() : '',
          ultimaActualizacion: new Date().toISOString()
        });

        // Si se bloquea la licencia y tiene vehículo asignado, desasignarlo
        if (nuevoEstadoBloqueo && vehiculo) {
          const vehiculoRef = ref(database, `vehiculos/${vehiculo.id}`);
          await update(vehiculoRef, {
            operadorAsignado: null,
            ultimaActualizacion: new Date().toISOString()
          });
        }

        setMessage({
          type: 'success',
          text: `✅ Licencia ${nuevoEstadoBloqueo ? 'bloqueada' : 'habilitada'} exitosamente`
        });

        // Actualizar el trabajador seleccionado
        setSelectedWorker({
          ...selectedWorker,
          licenciaBloqueada: nuevoEstadoBloqueo,
          motivoBloqueo: nuevoEstadoBloqueo ? 'Bloqueado por administrador' : '',
          fechaBloqueo: nuevoEstadoBloqueo ? new Date().toISOString() : ''
        });

        // Recargar datos
        loadTrabajadores();
        loadUsers();

      } catch (error) {
        console.error('Error al actualizar licencia:', error);
        setMessage({
          type: 'error',
          text: '❌ Error al actualizar el estado de la licencia'
        });
      } finally {
        setUpdatingLicense(false);
      }
    };

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'flex-start' : 'center',
        zIndex: 3000,
        padding: isMobile ? '10px' : '20px',
        overflowY: 'auto'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: isMobile ? '100%' : '800px',
          width: '100%',
          maxHeight: isMobile ? 'none' : '90vh',
          overflow: 'auto',
          padding: isMobile ? '20px' : '30px',
          marginTop: isMobile ? '20px' : '0',
          marginBottom: isMobile ? '20px' : '0'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px',
            paddingBottom: '15px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <h2 style={{
              margin: 0,
              color: '#1f2937',
              fontSize: isMobile ? '20px' : '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              👷 {selectedWorker.nombre || userData?.name || 'Trabajador'}
            </h2>
            <button
              onClick={() => {
                setShowWorkerDetailModal(false);
                setSelectedWorker(null);
              }}
              style={{
                padding: '8px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px',
                minWidth: '40px',
                height: '40px'
              }}
            >
              ✖
            </button>
          </div>

          {/* Información Personal */}
          <div style={{
            background: '#f9fafb',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#374151' }}>
              📋 Información Personal
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '15px'
            }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>RUT</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  {selectedWorker.rut || userData?.rut || 'No registrado'}
                </div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Email</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  {selectedWorker.email || userData?.email}
                </div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Teléfono</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  {selectedWorker.telefono || userData?.phone || 'No registrado'}
                </div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Estado</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    background: selectedWorker.estado === 'trabajando' ? '#dcfce7' :
                      selectedWorker.estado === 'en_camino' ? '#ede9fe' :
                        selectedWorker.estado === 'disponible' ? '#e0f2fe' : '#f3f4f6',
                    color: selectedWorker.estado === 'trabajando' ? '#15803d' :
                      selectedWorker.estado === 'en_camino' ? '#6b21a8' :
                        selectedWorker.estado === 'disponible' ? '#0891b2' : '#6b7280'
                  }}>
                    {selectedWorker.estado === 'trabajando' ? '🔧 Trabajando' :
                      selectedWorker.estado === 'en_camino' ? '🚗 En Camino' :
                        selectedWorker.estado === 'disponible' ? '✅ Disponible' : '⏸️ Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Información de Licencia */}
          <div style={{
            background: selectedWorker.licenciaBloqueada ? '#fee2e2' : '#f9fafb',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: selectedWorker.licenciaBloqueada ? '2px solid #ef4444' : 'none'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '16px',
              color: selectedWorker.licenciaBloqueada ? '#991b1b' : '#374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>🚗 Información de Licencia</span>
              {selectedWorker.licenciaBloqueada && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  🚫 BLOQUEADA
                </span>
              )}
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '15px',
              marginBottom: '15px'
            }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Licencias</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  {selectedWorker.licenciasConducir?.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                      {selectedWorker.licenciasConducir.map(lic => (
                        <span key={lic} style={{
                          padding: '3px 8px',
                          background: '#3b82f6',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Clase {lic}
                        </span>
                      ))}
                    </div>
                  ) : 'Sin licencia registrada'}
                </div>
              </div>

              <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Vencimiento</span>
                <div style={{ fontWeight: '500', fontSize: '15px' }}>
                  {selectedWorker.fechaVencimientoLicencia ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{new Date(selectedWorker.fechaVencimientoLicencia).toLocaleDateString('es-CL')}</span>
                      {estadoLicencia && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: estadoLicencia.color + '20',
                          color: estadoLicencia.color,
                          border: `1px solid ${estadoLicencia.color}`
                        }}>
                          {estadoLicencia.tipo === 'vencida' ? '⚠️ VENCIDA' :
                            estadoLicencia.tipo === 'porVencer' ? `⚠️ Vence en ${estadoLicencia.dias} días` :
                              '✅ Vigente'}
                        </span>
                      )}
                    </div>
                  ) : 'No registrado'}
                </div>
              </div>

              {selectedWorker.observacionesLicencia && (
                <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Observaciones/Restricciones</span>
                  <div style={{
                    fontWeight: '500',
                    fontSize: '14px',
                    padding: '10px',
                    background: 'white',
                    borderRadius: '6px',
                    marginTop: '5px'
                  }}>
                    {selectedWorker.observacionesLicencia}
                  </div>
                </div>
              )}

              {selectedWorker.licenciaBloqueada && (
                <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                  <span style={{ color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
                    Motivo del Bloqueo
                  </span>
                  <div style={{
                    fontSize: '14px',
                    padding: '10px',
                    background: '#fef2f2',
                    borderRadius: '6px',
                    marginTop: '5px',
                    color: '#7f1d1d'
                  }}>
                    {selectedWorker.motivoBloqueo || 'No especificado'}
                    {selectedWorker.fechaBloqueo && (
                      <div style={{ fontSize: '12px', marginTop: '5px', color: '#991b1b' }}>
                        Bloqueado el: {new Date(selectedWorker.fechaBloqueo).toLocaleDateString('es-CL')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Botón para bloquear/habilitar licencia */}
            <button
              onClick={handleToggleLicenseBlock}
              disabled={updatingLicense || !selectedWorker.licenciasConducir?.length}
              style={{
                width: '100%',
                padding: '12px',
                background: selectedWorker.licenciaBloqueada ? '#22c55e' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: updatingLicense || !selectedWorker.licenciasConducir?.length ? 'not-allowed' : 'pointer',
                opacity: updatingLicense || !selectedWorker.licenciasConducir?.length ? 0.5 : 1
              }}
            >
              {updatingLicense ? 'Procesando...' :
                selectedWorker.licenciaBloqueada ? '✅ Habilitar Licencia' : '🚫 Bloquear Licencia'}
            </button>

            {!selectedWorker.licenciasConducir?.length && (
              <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px', textAlign: 'center' }}>
                No se puede gestionar sin licencia registrada
              </small>
            )}
          </div>

          {/* Información del Vehículo */}
          <div style={{
            background: '#f9fafb',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#374151' }}>
              🚛 Vehículo Asignado
            </h3>
            {vehiculo ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: '15px'
              }}>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Nombre</span>
                  <div style={{ fontWeight: '500', fontSize: '15px' }}>{vehiculo.nombre}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Patente</span>
                  <div style={{ fontWeight: '500', fontSize: '15px' }}>{vehiculo.patente}</div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Marca/Modelo</span>
                  <div style={{ fontWeight: '500', fontSize: '15px' }}>
                    {vehiculo.marca} {vehiculo.modelo}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#6b7280', fontSize: '13px' }}>Estado</span>
                  <div style={{ fontWeight: '500', fontSize: '15px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      background: vehiculo.estado === 'disponible' ? '#dcfce7' :
                        vehiculo.estado === 'en_uso' ? '#dbeafe' :
                          vehiculo.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                      color: vehiculo.estado === 'disponible' ? '#15803d' :
                        vehiculo.estado === 'en_uso' ? '#1e40af' :
                          vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                    }}>
                      {vehiculo.estado === 'disponible' ? '✅ Disponible' :
                        vehiculo.estado === 'en_uso' ? '🔧 En Uso' :
                          vehiculo.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera de Servicio'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '20px',
                background: 'white',
                borderRadius: '6px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                Sin vehículo asignado
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => {
                openEditModal(selectedWorker, 'worker');
                setShowWorkerDetailModal(false);
              }}
              style={{
                flex: 1,
                padding: '12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ✏️ Editar Información
            </button>
            <button
              onClick={() => {
                loadWorkerDocuments(selectedWorker.id, selectedWorker);
                setShowWorkerDetailModal(false);
              }}
              style={{
                flex: 1,
                padding: '12px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              📄 Ver Documentos
            </button>
          </div>
        </div>
      </div>
    );
  };
  // Función para renderizar tarjetas de usuario (reutilizable)
  const renderUserCard = (usuario, rolColor) => {
    const userData = users.find(u => u.id === usuario.id);
    const vehiculo = vehiculos.find(v => v.operadorAsignado === usuario.id);
    const isExpanded = expandedCards[usuario.id];
    const isGPSActive = usuario.ubicacion &&
      (new Date() - new Date(usuario.ubicacion.timestamp)) < 60000;

    let tieneProblemaLicencia = false;
    if (usuario.licenciaBloqueada) {
      tieneProblemaLicencia = true;
    } else if (usuario.fechaVencimientoLicencia) {
      const fechaVencimiento = new Date(usuario.fechaVencimientoLicencia);
      const hoy = new Date();
      const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
      if (diasRestantes <= 14) tieneProblemaLicencia = true;
    }

    return (
      <div key={usuario.id} style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        border: isGPSActive ? '2px solid #10b981' :
          tieneProblemaLicencia ? '2px solid #f59e0b' : '1px solid #e5e7eb'
      }}>
        <div style={{
          padding: '15px 20px',
          background: rolColor,
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
              {usuario.role === 'admin' ? '👨‍💼' :
                usuario.role === 'superadmin' ? '🔐' : '👷'} {usuario.nombre || userData?.name || 'Usuario'}
            </h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {usuario.licenciaBloqueada && (
                <span style={{
                  padding: '2px 6px',
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  🚫 LIC.BLOQ
                </span>
              )}
              {isGPSActive && (
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'pulse 2s infinite'
                }} title="GPS Activo" />
              )}
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                background: 'white',
                color: usuario.role === 'admin' ? '#1e40af' :
                  usuario.role === 'superadmin' ? '#6b21a8' :
                    usuario.estado === 'trabajando' ? '#15803d' :
                      usuario.estado === 'disponible' ? '#0891b2' : '#6b7280'
              }}>
                {usuario.role === 'admin' ? 'Administrador' :
                  usuario.role === 'superadmin' ? 'Super Admin' :
                    usuario.estado === 'trabajando' ? '🔧 Trabajando' :
                      usuario.estado === 'disponible' ? '✅ Disponible' : '⏸️ Inactivo'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>📧 Email:</span>
              <span style={{ fontWeight: '500', fontSize: '13px' }}>{userData?.email || usuario.email || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280' }}>📱 Teléfono:</span>
              <span style={{ fontWeight: '500' }}>{userData?.phone || usuario.telefono || 'N/A'}</span>
            </div>

            {/* Solo mostrar vehículo para trabajadores */}
            {(!usuario.role || usuario.role === 'trabajador') && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>🚛 Vehículo:</span>
                <span style={{ fontWeight: '500' }}>{vehiculo?.nombre || 'Sin asignar'}</span>
              </div>
            )}

            {/* Mostrar localidad para admins/superadmins si tienen */}
            {usuario.localidad && (usuario.role === 'admin' || usuario.role === 'superadmin') && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>📍 Localidad:</span>
                <span style={{ fontWeight: '500' }}>{usuario.localidad}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6b7280' }}>🚗 Licencias:</span>
              <span style={{ fontWeight: '500' }}>
                {usuario.licenciasConducir?.length > 0 ?
                  usuario.licenciasConducir.join(', ') :
                  usuario.licenciaConducir || 'Sin licencia'}
              </span>
            </div>

            {(!usuario.role || usuario.role === 'trabajador') && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>📍 GPS:</span>
                <span style={{
                  fontWeight: '500',
                  color: isGPSActive ? '#10b981' : '#ef4444'
                }}>
                  {isGPSActive ? '🟢 Activo' : '🔴 Inactivo'}
                </span>
              </div>
            )}

            {isExpanded && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '5px' }}>
                {usuario.fechaVencimientoLicencia && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280' }}>📅 Vence Licencia:</span>
                    <span style={{ fontWeight: '500', fontSize: '13px' }}>
                      {new Date(usuario.fechaVencimientoLicencia).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                )}

                {usuario.observacionesLicencia && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#fef3c7',
                    borderRadius: '6px'
                  }}>
                    <strong style={{ color: '#92400e', fontSize: '12px' }}>⚠️ Restricciones:</strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                      {usuario.observacionesLicencia}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            marginTop: '15px'
          }}>
            <button
              onClick={() => toggleCardExpansion(usuario.id)}
              style={{
                padding: isMobile ? '6px' : '8px',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile ? '11px' : '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {isExpanded ? '➖ Menos' : '➕ Más'}
            </button>
            <button
              onClick={() => {
                setSelectedWorker(usuario);
                setShowWorkerDetailModal(true);
              }}
              style={{
                padding: isMobile ? '6px' : '8px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile ? '11px' : '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              👁️ Ver Todo
            </button>
            <button
              onClick={() => loadWorkerDocuments(usuario.id, usuario)}
              style={{
                padding: isMobile ? '6px' : '8px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile ? '11px' : '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📄 Docs
            </button>
            <button
              onClick={() => openEditModal(usuario, 'worker')}
              style={{
                padding: isMobile ? '6px' : '8px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile ? '11px' : '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ✏️ Editar
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f3f4f6' }}>
      {/* SIDEBAR IZQUIERDO */}
      <div style={{
        width: isMobile ? '280px' : '260px',
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: isMobile ? 'fixed' : 'relative',
        height: '100vh',
        zIndex: 999,
        left: isMobile ? (isSidebarOpen ? '0' : '-280px') : '0',
        boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible' // CAMBIAR A VISIBLE para permitir que el dropdown se muestre
      }}>
        {/* Header del Sidebar */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(0,0,0,0.2)',
          position: 'relative'
        }}>
          <span style={{
            fontSize: '32px',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }}>
            🚛
          </span>
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0,
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              Panel de Flota
            </h2>
            <p style={{
              margin: 0,
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px'
            }}>
              Control de vehículos
            </p>
          </div>
          {/* Botón de cerrar sidebar (solo móvil) */}
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{
                position: 'absolute',
                right: '15px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '18px',
                transition: 'all 0.2s ease',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sección de Notificaciones */}
        <div style={{
          padding: '10px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative', // Importante para el posicionamiento
          zIndex: 1001 // Mayor z-index
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            position: 'relative' // Añadir posición relativa
          }}>
            <NotificationSystem
              currentUser={currentUser}
              isMobile={isMobile}
              inSidebar={true}
              dropdownPosition={isMobile ? 'right' : 'right'} // Forzar que el dropdown aparezca a la derecha
              style={{
                position: 'relative',
                zIndex: 1002
              }}
            />

          </div>
        </div>

        {/* Botón Super Admin */}
        {currentUser.role === 'superadmin' && (
          <div style={{ padding: '10px' }}>
            <button
              onClick={() => onViewChange('admin')}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateX(2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateX(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
              }}
            >
              🔐 Super Administrador
            </button>
          </div>
        )}

        {/* Espaciador flexible */}
        <div style={{ flex: 1 }}></div>

        {/* Footer del Sidebar */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '15px',
            color: 'white'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px'
            }}>
              👤
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentUser.name || 'Usuario'}
              </div>
              <div style={{
                fontSize: '12px',
                opacity: 0.7,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentUser.email}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '10px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ef4444';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {/* Botón hamburguesa para móvil */}
        {isMobile && (
          <div style={{
            background: 'white',
            padding: '15px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                background: '#1e293b',
                color: 'white',
                border: 'none',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '20px'
              }}
            >
              ☰
            </button>
            <h1 style={{
              margin: 0,
              fontSize: '18px',
              color: '#1e293b'
            }}>
              Panel de Gestión de Flota
            </h1>
          </div>
        )}
        {/* Contenedor principal con padding reducido */}
        <div style={{
          padding: isMobile ? '10px' : '15px',
          paddingTop: isMobile ? '10px' : '15px' // Reducir mucho más el padding superior
        }}>
          {/* Área para el logo en la esquina superior izquierda */}
          {!isMobile && (
            <div style={{
              position: 'fixed', // CAMBIAR de 'absolute' a 'fixed'
              top: '15px',
              left: '275px', // Justo después del sidebar (260px + 15px de margen)
              width: '120px',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'white',
              borderRadius: '8px',
              padding: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              zIndex: 100, // Agregar z-index para que esté sobre otros elementos
              border: '1px solid #e5e7eb' // Añadir un borde sutil
            }}>
              <img
                src="/logoQuillon.jpg" // Aquí colocar la ruta correcta del logo
                alt="Municipalidad de Quillón"
                style={{
                  maxWidth: '150px',
                  maxHeight: '150px',
                  objectFit: 'contain'
                }}
              />
            </div>
          )}
        </div>
        <div style={{
          padding: isMobile ? '15px' : '30px',
          paddingTop: isMobile ? '20px' : '30px' // Reducir el padding superior
        }}></div>
        <div style={{
          padding: isMobile ? '20px' : '40px', // Aumentar padding
          paddingTop: isMobile ? '30px' : '50px' // Más espacio arriba
        }}></div>
        {/* Estadísticas rápidas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '140px' : '200px'}, 1fr))`,
          gap: '15px',
          marginBottom: '25px'
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {vehicleStats.total}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>🚛 Total Vehículos</div>
          </div>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #22c55e'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {vehicleStats.disponibles}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>✅ Disponibles</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {vehicleStats.enUso}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>🔧 En Uso</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #8b5cf6'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {workerStats.total}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>👷 Trabajadores</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {workerStats.activos}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>🟢 GPS Activos</div>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            borderLeft: '4px solid #06b6d4'
          }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
              {workerStats.trabajando}
            </div>
            <div style={{ color: '#6b7280', fontSize: '13px' }}>🔧 Trabajando</div>
          </div>
        </div>

        {/* Controles de búsqueda y filtros */}
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, patente, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: isMobile ? '1 1 100%' : '1 1 300px',
                padding: '10px 15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '10px 15px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="todos">📋 Todos</option>
              <option value="disponible">✅ Disponible</option>
              <option value="en_uso">🔧 En Uso</option>
              <option value="mantenimiento">🔧 Mantenimiento</option>
              <option value="en_camino">🚗 En Camino</option>
              <option value="trabajando">👷 Trabajando</option>
            </select>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          borderBottom: '2px solid #e5e7eb',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('vehicles')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'vehicles' ? 'white' : 'transparent',
              color: activeTab === 'vehicles' ? '#1e293b' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'vehicles' ? '2px solid #3b82f6' : 'none',
              fontSize: '16px',
              fontWeight: activeTab === 'vehicles' ? '600' : '400',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            🚛 Vehículos ({filteredVehiculos.length})
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'workers' ? 'white' : 'transparent',
              color: activeTab === 'workers' ? '#1e293b' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'workers' ? '2px solid #3b82f6' : 'none',
              fontSize: '16px',
              fontWeight: activeTab === 'workers' ? '600' : '400',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            👷 Trabajadores ({trabajadoresReales.length})
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'admins' ? 'white' : 'transparent',
              color: activeTab === 'admins' ? '#1e293b' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'admins' ? '2px solid #3b82f6' : 'none',
              fontSize: '16px',
              fontWeight: activeTab === 'admins' ? '600' : '400',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            👨‍💼 Administradores ({administradores.length})
          </button>
          <button
            onClick={() => setActiveTab('superadmins')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'superadmins' ? 'white' : 'transparent',
              color: activeTab === 'superadmins' ? '#1e293b' : '#64748b',
              border: 'none',
              borderBottom: activeTab === 'superadmins' ? '2px solid #3b82f6' : 'none',
              fontSize: '16px',
              fontWeight: activeTab === 'superadmins' ? '600' : '400',
              cursor: 'pointer',
              marginBottom: '-2px'
            }}
          >
            🔐 Super Admins ({superAdmins.length})
          </button>
        </div>

        {/* Lista de Vehículos */}
        {activeTab === 'vehicles' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {filteredVehiculos.map(vehiculo => {
              const operador = users.find(u => u.id === vehiculo.operadorAsignado);
              const isExpanded = expandedCards[vehiculo.id];
              const isEditingOperator = quickEditMode[vehiculo.id];

              return (
                <div key={vehiculo.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  border: vehiculo.estado === 'en_uso' ? '2px solid #3b82f6' : '1px solid #e5e7eb'
                }}>
                  {/* Header de la tarjeta */}
                  <div style={{
                    padding: '15px 20px',
                    background: vehiculo.estado === 'disponible' ? '#dcfce7' :
                      vehiculo.estado === 'en_uso' ? '#dbeafe' :
                        vehiculo.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                        {vehiculo.tipo === 'maquinaria' ? '🏗️' : '🚗'} {vehiculo.nombre}
                      </h3>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: 'white',
                        color: vehiculo.estado === 'disponible' ? '#15803d' :
                          vehiculo.estado === 'en_uso' ? '#1e40af' :
                            vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                      }}>
                        {vehiculo.estado === 'disponible' ? '✅ Disponible' :
                          vehiculo.estado === 'en_uso' ? '🔧 En Uso' :
                            vehiculo.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera de Servicio'}
                      </span>
                    </div>
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>📋 Patente:</span>
                        <span style={{ fontWeight: '500' }}>{vehiculo.patente || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>🏭 Marca/Modelo:</span>
                        <span style={{ fontWeight: '500' }}>{vehiculo.marca} {vehiculo.modelo}</span>
                      </div>

                      {/* Campo de operador con edición rápida */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px',
                        background: isEditingOperator ? '#f0f9ff' : 'transparent',
                        borderRadius: '6px',
                        border: isEditingOperator ? '2px solid #3b82f6' : 'none',
                        margin: isEditingOperator ? '-2px' : '0'
                      }}>
                        <span style={{ color: '#6b7280', minWidth: '80px' }}>👤 Operador:</span>
                        {isEditingOperator ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                            <select
                              style={{
                                flex: 1,
                                padding: '6px',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                fontSize: '13px',
                                background: 'white'
                              }}
                              defaultValue={vehiculo.operadorAsignado || ''}
                              onChange={(e) => {
                                quickUpdateOperator(vehiculo.id, e.target.value);
                              }}
                              disabled={loading}
                            >
                              <option value="">Sin asignar</option>
                              {users.filter(u => u.role === 'trabajador').map(user => {
                                // Verificar si el trabajador cumple con las licencias requeridas
                                const trabajador = trabajadores.find(t => t.id === user.id);
                                const licenciasTrabajador = trabajador?.licenciasConducir || [];
                                const cumpleRequisitos = !vehiculo.licenciasRequeridas ||
                                  vehiculo.licenciasRequeridas.length === 0 ||
                                  vehiculo.licenciasRequeridas.some(licReq => licenciasTrabajador.includes(licReq));

                                const tieneLicenciaBloqueada = trabajador?.licenciaBloqueada;

                                return (
                                  <option
                                    key={user.id}
                                    value={user.id}
                                    disabled={!cumpleRequisitos || tieneLicenciaBloqueada}
                                    style={{
                                      color: !cumpleRequisitos || tieneLicenciaBloqueada ? '#ef4444' : '#000'
                                    }}
                                  >
                                    {user.name || user.email}
                                    {!cumpleRequisitos && ' ❌ (Sin licencia requerida)'}
                                    {tieneLicenciaBloqueada && ' 🚫 (Licencia bloqueada)'}
                                    {cumpleRequisitos && !tieneLicenciaBloqueada && licenciasTrabajador.length > 0 &&
                                      ` ✓ (${licenciasTrabajador.join(', ')})`}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              onClick={() => setQuickEditMode({ ...quickEditMode, [vehiculo.id]: false })}
                              style={{
                                padding: '4px 8px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>{operador?.name || 'Sin asignar'}</span>
                            <button
                              onClick={() => setQuickEditMode({ ...quickEditMode, [vehiculo.id]: true })}
                              style={{
                                padding: '2px 6px',
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              Cambiar
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>📏 Kilometraje:</span>
                        <span style={{ fontWeight: '500' }}>{vehiculo.kilometraje?.toLocaleString() || 0} km</span>
                      </div>

                      {/* Información expandida */}
                      {isExpanded && (
                        <>
                          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: '#6b7280' }}>⛽ Combustible:</span>
                              <span style={{ fontWeight: '500' }}>{vehiculo.tipoCombustible || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: '#6b7280' }}>🔧 Último Mant.:</span>
                              <span style={{ fontWeight: '500' }}>
                                {vehiculo.ultimoMantenimiento ?
                                  new Date(vehiculo.ultimoMantenimiento).toLocaleDateString('es-CL') :
                                  'Sin registro'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: '#6b7280' }}>📅 Próximo Mant.:</span>
                              <span style={{ fontWeight: '500' }}>
                                {vehiculo.proximoMantenimiento ?
                                  new Date(vehiculo.proximoMantenimiento).toLocaleDateString('es-CL') :
                                  'No programado'}
                              </span>
                            </div>
                            {vehiculo.observaciones && (
                              <div style={{ marginTop: '10px', padding: '10px', background: '#f9fafb', borderRadius: '6px' }}>
                                <strong style={{ color: '#6b7280', fontSize: '12px' }}>📝 Observaciones:</strong>
                                <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>{vehiculo.observaciones}</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                      gap: '8px',
                      marginTop: '15px'
                    }}>
                      <button
                        onClick={() => toggleCardExpansion(vehiculo.id)}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {isExpanded ? '➖' : '➕'} {!isMobile && (isExpanded ? 'Menos' : 'Más')}
                      </button>
                      <button
                        onClick={() => loadVehicleDocuments(vehiculo.id, vehiculo)}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        📄 {!isMobile && 'Docs'}
                      </button>
                      <button
                        onClick={() => openEditModal(vehiculo, 'vehicle')}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        ✏️ {!isMobile && 'Editar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lista de Trabajadores */}
        {activeTab === 'workers' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {filteredTrabajadores.map(trabajador => {
              const userData = users.find(u => u.id === trabajador.id);
              const vehiculo = vehiculos.find(v => v.operadorAsignado === trabajador.id);
              const isExpanded = expandedCards[trabajador.id];
              const isGPSActive = trabajador.ubicacion &&
                (new Date() - new Date(trabajador.ubicacion.timestamp)) < 60000;

              // Calcular estado de licencia
              let tieneProblemaLicencia = false;
              if (trabajador.licenciaBloqueada) {
                tieneProblemaLicencia = true;
              } else if (trabajador.fechaVencimientoLicencia) {
                const fechaVencimiento = new Date(trabajador.fechaVencimientoLicencia);
                const hoy = new Date();
                const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));
                if (diasRestantes <= 14) tieneProblemaLicencia = true;
              }

              return (
                <div key={trabajador.id} style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  border: isGPSActive ? '2px solid #10b981' :
                    tieneProblemaLicencia ? '2px solid #f59e0b' : '1px solid #e5e7eb'
                }}>
                  {/* Header de la tarjeta */}
                  <div style={{
                    padding: '15px 20px',
                    background: trabajador.estado === 'en_camino' ? '#ede9fe' :
                      trabajador.estado === 'trabajando' ? '#dcfce7' :
                        trabajador.estado === 'disponible' ? '#e0f2fe' : '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                        👷 {trabajador.nombre || userData?.name || 'Trabajador'}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {trabajador.licenciaBloqueada && (
                          <span style={{
                            padding: '2px 6px',
                            background: '#ef4444',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            🚫 LIC.BLOQ
                          </span>
                        )}
                        {isGPSActive && (
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#10b981',
                            animation: 'pulse 2s infinite'
                          }} title="GPS Activo" />
                        )}
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: 'white',
                          color: trabajador.estado === 'en_camino' ? '#6b21a8' :
                            trabajador.estado === 'trabajando' ? '#15803d' :
                              trabajador.estado === 'disponible' ? '#0891b2' : '#6b7280'
                        }}>
                          {trabajador.estado === 'en_camino' ? '🚗 En Camino' :
                            trabajador.estado === 'trabajando' ? '🔧 Trabajando' :
                              trabajador.estado === 'disponible' ? '✅ Disponible' : '⏸️ Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div style={{ padding: '20px' }}>
                    <div style={{ display: 'grid', gap: '10px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>📧 Email:</span>
                        <span style={{ fontWeight: '500', fontSize: '13px' }}>{userData?.email || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>📱 Teléfono:</span>
                        <span style={{ fontWeight: '500' }}>{userData?.phone || trabajador.telefono || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>🚛 Vehículo:</span>
                        <span style={{ fontWeight: '500' }}>{vehiculo?.nombre || 'Sin asignar'}</span>
                      </div>

                      {/* NUEVA INFORMACIÓN DE LICENCIA */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#6b7280' }}>🚗 Licencias:</span>
                        <span style={{ fontWeight: '500' }}>
                          {trabajador.licenciasConducir?.length > 0 ?
                            trabajador.licenciasConducir.join(', ') :
                            trabajador.licenciaConducir || 'Sin licencia'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>📍 GPS:</span>
                        <span style={{
                          fontWeight: '500',
                          color: isGPSActive ? '#10b981' : '#ef4444'
                        }}>
                          {isGPSActive ? '🟢 Activo' : '🔴 Inactivo'}
                        </span>
                      </div>

                      {/* Información expandida */}
                      {isExpanded && (
                        <>
                          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '5px' }}>
                            {/* NUEVO: Mostrar licencias requeridas */}
                            {vehiculo.licenciasRequeridas && vehiculo.licenciasRequeridas.length > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280' }}>🚗 Licencias Requeridas:</span>
                                <span style={{ fontWeight: '500' }}>
                                  {vehiculo.licenciasRequeridas.map(lic => (
                                    <span key={lic} style={{
                                      padding: '2px 6px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      marginLeft: '4px'
                                    }}>
                                      Clase {lic}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            )}
                            {/* Información adicional de licencia */}
                            {trabajador.fechaVencimientoLicencia && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280' }}>📅 Vence Licencia:</span>
                                <span style={{ fontWeight: '500', fontSize: '13px' }}>
                                  {new Date(trabajador.fechaVencimientoLicencia).toLocaleDateString('es-CL')}
                                </span>
                              </div>
                            )}

                            {trabajador.observacionesLicencia && (
                              <div style={{
                                marginTop: '10px',
                                padding: '10px',
                                background: '#fef3c7',
                                borderRadius: '6px'
                              }}>
                                <strong style={{ color: '#92400e', fontSize: '12px' }}>⚠️ Restricciones:</strong>
                                <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>
                                  {trabajador.observacionesLicencia}
                                </p>
                              </div>
                            )}

                            {trabajador.zonaDestino && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280' }}>🎯 Zona Destino:</span>
                                <span style={{ fontWeight: '500' }}>{trabajador.zonaDestino}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      marginTop: '15px'
                    }}>
                      <button
                        onClick={() => toggleCardExpansion(trabajador.id)}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#f3f4f6',
                          color: '#374151',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {isExpanded ? '➖ Menos' : '➕ Más'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedWorker(trabajador);
                          setShowWorkerDetailModal(true);
                        }}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        👁️ Ver Todo
                      </button>
                      <button
                        onClick={() => loadWorkerDocuments(trabajador.id, trabajador)}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        📄 Docs
                      </button>
                      <button
                        onClick={() => openEditModal(trabajador, 'worker')}
                        style={{
                          padding: isMobile ? '6px' : '8px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: isMobile ? '11px' : '13px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Lista de Administradores */}
        {activeTab === 'admins' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {administradores.map(admin => renderUserCard(admin, '#dbeafe'))}

            {administradores.length === 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '60px 20px',
                textAlign: 'center',
                color: '#6b7280',
                gridColumn: '1 / -1'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>👨‍💼</div>
                <p style={{ fontSize: '16px' }}>
                  No hay administradores registrados
                </p>
              </div>
            )}
          </div>
        )}

        {/* Lista de Super Admins */}
        {activeTab === 'superadmins' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {superAdmins.map(superAdmin => renderUserCard(superAdmin, '#ede9fe'))}

            {superAdmins.length === 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '60px 20px',
                textAlign: 'center',
                color: '#6b7280',
                gridColumn: '1 / -1'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔐</div>
                <p style={{ fontSize: '16px' }}>
                  No hay super administradores registrados
                </p>
              </div>
            )}
          </div>
        )}

        {/* No hay resultados */}
        {((activeTab === 'vehicles' && filteredVehiculos.length === 0) ||
          (activeTab === 'workers' && filteredTrabajadores.length === 0)) && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '60px 20px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>
                {activeTab === 'vehicles' ? '🚛' : '👷'}
              </div>
              <p style={{ fontSize: '16px' }}>
                No se encontraron {activeTab === 'vehicles' ? 'vehículos' : 'trabajadores'}
                {searchTerm && ` para "${searchTerm}"`}
                {filterStatus !== 'todos' && ` con estado "${filterStatus}"`}
              </p>
            </div>
          )}
      </div>

      {/* Modal de edición */}
      {showEditModal && editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: isMobile ? '20px' : '30px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>
              ✏️ Editar {editingItem.type === 'vehicle' ? 'Vehículo' : 'Trabajador'}
            </h2>

            {editingItem.type === 'vehicle' ? (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editFormData.nombre}
                    onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Patente
                  </label>
                  <input
                    type="text"
                    value={editFormData.patente}
                    onChange={(e) => setEditFormData({ ...editFormData, patente: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Kilometraje
                  </label>
                  <input
                    type="number"
                    value={editFormData.kilometraje}
                    onChange={(e) => setEditFormData({ ...editFormData, kilometraje: parseInt(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Operador Asignado
                  </label>
                  <select
                    value={editFormData.operadorAsignado}
                    onChange={(e) => setEditFormData({ ...editFormData, operadorAsignado: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Sin asignar --</option>
                    {users.filter(u => u.role === 'trabajador').map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Observaciones
                  </label>
                  <textarea
                    value={editFormData.observaciones}
                    onChange={(e) => setEditFormData({ ...editFormData, observaciones: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editFormData.nombre}
                    onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editFormData.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#f3f4f6',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={editFormData.telefono}
                    onChange={(e) => setEditFormData({ ...editFormData, telefono: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>
                    Vehículo Asignado
                  </label>
                  <select
                    value={editFormData.vehicleId}
                    onChange={(e) => setEditFormData({ ...editFormData, vehicleId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">-- Sin asignar --</option>
                    {vehiculos.filter(v => !v.operadorAsignado || v.operadorAsignado === editingItem.id).map(vehiculo => (
                      <option key={vehiculo.id} value={vehiculo.id}>
                        {vehiculo.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => editingItem.type === 'vehicle' ? saveVehicleChanges() : saveWorkerChanges()}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: loading ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Guardando...' : '✅ Guardar Cambios'}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Documentos */}
      <DocumentsModal />
      <WorkerDetailModal />
      <style jsx>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
          
      `}</style>

    </div>
  );
};

export default FleetPanel;