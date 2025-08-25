// src/components/SistemaTrabajadoresFirebase.js
import React, { useEffect, useRef, useState } from 'react';
import { trabajadoresService } from '../services/firebaseservices';
import { database } from '../config/firebase';
import { ref, onValue, update, set, push, get } from 'firebase/database';
import TrabajadorVehiclePanel from './TrabajadorVehiclePanel';
import { cloudinaryConfig } from '../config/cloudinary';

const SistemaTrabajadoresFirebase = ({ currentUser, onLogout, onViewChange }) => {
  // Estados principales
  const [showVehiclePanel, setShowVehiclePanel] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [selectedZona, setSelectedZona] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [workStatus, setWorkStatus] = useState('idle');
  
  // Estados para zonas y notificaciones
  const [zonasAsignadas, setZonasAsignadas] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  
  // ESTADOS PARA DOCUMENTOS
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [documentos, setDocumentos] = useState({
    licenciaConducir: { url: '', nombre: '', fecha: '', vencimiento: '' },
    certificadoOperador: { url: '', nombre: '', fecha: '', vencimiento: '' },
    certificados: []
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  
  // Referencias
  const toastTimeoutRef = useRef(null);
  const [gpsStatus, setGpsStatus] = useState('inactive');

  // ========== FUNCIONES COMPLETAS PARA MANEJO DE DOCUMENTOS ==========
  
  // 1. FUNCIÓN PARA SUBIR ARCHIVOS (COMPLETA Y MEJORADA)
  const handleFileUpload = async (file, tipoDocumento) => {
    if (!file) return;
    
    // Validación de PDF
    if (file.type === 'application/pdf') {
      setMessage({ 
        type: 'error', 
        text: '❌ NO se permiten PDFs. Por favor, sube una FOTO o IMAGEN del documento (JPG/PNG).' 
      });
      
      alert(
        '📸 ALTERNATIVAS PARA SUBIR TU DOCUMENTO:\n\n' +
        '1. Toma una FOTO con tu celular\n' +
        '2. Haz una CAPTURA DE PANTALLA del PDF\n' +
        '3. Usa un escáner que guarde como JPG\n' +
        '4. Convierte el PDF a imagen en: https://www.ilovepdf.com/pdf_to_jpg'
      );
      
      return;
    }
    
    // Validación de tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ 
        type: 'error', 
        text: '❌ Solo se permiten imágenes JPG y PNG' 
      });
      return;
    }
    
    // Validación de tamaño
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ 
        type: 'error', 
        text: '❌ El archivo no puede superar los 10MB' 
      });
      return;
    }

    setUploadingFile(true);
    setUploadProgress({ [tipoDocumento]: 0 });

    try {
      // Preparar FormData para Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'vehiculos_docs');
      
      const trabajadorId = currentUser.uid || `temp_${Date.now()}`;
      const timestamp = Date.now();
      const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
      
      formData.append('folder', `municipalidad/trabajadores/${trabajadorId}/${tipoDocumento}`);
      formData.append('public_id', `${timestamp}_${cleanFileName}`);
      
      setUploadProgress({ [tipoDocumento]: 30 });

      // Subir a Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      setUploadProgress({ [tipoDocumento]: 60 });

      if (!response.ok) {
        throw new Error('Error al subir imagen a Cloudinary');
      }

      const data = await response.json();
      console.log('✅ Imagen subida a Cloudinary:', data);
      
      setUploadProgress({ [tipoDocumento]: 90 });

      // Crear objeto de documento con todos los datos necesarios
      const documentData = {
        url: data.secure_url || '',
        publicId: data.public_id || '',
        nombre: file.name || 'documento',
        fecha: new Date().toISOString(),
        tamaño: file.size || 0,
        tipo: file.type || 'image/jpeg',
        vencimiento: '' // Campo opcional para fechas de vencimiento
      };

      console.log('📄 Datos del documento a guardar:', documentData);

      // Guardar en Firebase PRIMERO
      await guardarDocumentosEnFirebase(tipoDocumento, documentData);

      // DESPUÉS actualizar el estado local
      if (tipoDocumento === 'certificados') {
        setDocumentos(prev => ({
          ...prev,
          certificados: [...(prev.certificados || []), documentData]
        }));
      } else {
        setDocumentos(prev => ({
          ...prev,
          [tipoDocumento]: documentData
        }));
      }

      setUploadProgress({ [tipoDocumento]: 100 });
      setMessage({ 
        type: 'success', 
        text: `✅ ${file.name} subido exitosamente` 
      });
      showToast('✅ Documento subido exitosamente', 'success');

      setTimeout(() => {
        setUploadProgress({});
        setMessage({ type: '', text: '' });
      }, 3000);

    } catch (error) {
      console.error('❌ Error completo:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error al subir la imagen: ' + error.message 
      });
      showToast('❌ Error al subir el documento', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // 2. FUNCIÓN PARA GUARDAR EN FIREBASE (CONSISTENTE)
  const guardarDocumentosEnFirebase = async (tipoDocumento, documentData) => {
    try {
      console.log(`🔄 Guardando ${tipoDocumento} en Firebase...`);
      console.log('📝 Datos a guardar:', documentData);
      
      if (!currentUser || !currentUser.uid) {
        throw new Error('No hay usuario autenticado');
      }
      
      // IMPORTANTE: Guardar siempre en la misma ruta donde se encontraron los documentos
      // Primero verificar dónde están los documentos actuales
      const rutaPrincipal = `documentos/${currentUser.uid}`; // Usar esta ruta como principal
      const rutaAlternativa = `trabajadores/${currentUser.uid}/documentos`;
      
      // Verificar si ya hay documentos en alguna ruta
      const checkRef1 = ref(database, rutaPrincipal);
      const checkRef2 = ref(database, rutaAlternativa);
      
      const snapshot1 = await get(checkRef1);
      const snapshot2 = await get(checkRef2);
      
      // Determinar qué ruta usar basándose en dónde están los documentos existentes
      let rutaAUsar = rutaPrincipal; // Por defecto usar documentos/uid
      
      if (snapshot2.val() && Object.keys(snapshot2.val()).length > 0) {
        // Si hay documentos en trabajadores/uid/documentos, usar esa
        rutaAUsar = rutaAlternativa;
      }
      
      console.log(`📍 Usando ruta: ${rutaAUsar}`);
      
      if (tipoDocumento === 'certificados') {
        // Para certificados, usar push para crear una lista
        const certificadosRef = ref(database, `${rutaAUsar}/certificados`);
        const newCertRef = push(certificadosRef);
        await set(newCertRef, documentData);
        console.log(`✅ Certificado guardado con ID:`, newCertRef.key);
      } else {
        // Para licencia y certificado de operador
        const docRef = ref(database, `${rutaAUsar}/${tipoDocumento}`);
        await set(docRef, documentData);
        console.log(`✅ ${tipoDocumento} guardado en Firebase`);
      }
      
      // Verificar que se guardó correctamente
      const verificarRef = ref(database, rutaAUsar);
      const snapshot = await get(verificarRef);
      console.log('📦 Verificación - Documentos guardados:', snapshot.val());
      
      // Forzar actualización del estado local inmediatamente
      const docsActualizados = snapshot.val();
      if (docsActualizados) {
        const docsToUpdate = {
          licenciaConducir: docsActualizados.licenciaConducir || { url: '', nombre: '', fecha: '', vencimiento: '' },
          certificadoOperador: docsActualizados.certificadoOperador || { url: '', nombre: '', fecha: '', vencimiento: '' },
          certificados: []
        };
        
        if (docsActualizados.certificados) {
          docsToUpdate.certificados = Object.entries(docsActualizados.certificados).map(([key, cert]) => ({
            firebaseKey: key,
            ...cert
          }));
        }
        
        console.log('🔄 Actualizando estado local con:', docsToUpdate);
        setDocumentos(docsToUpdate);
      }
      
    } catch (error) {
      console.error('❌ Error al guardar en Firebase:', error);
      throw error;
    }
  };

  // 3. FUNCIÓN PARA ELIMINAR DOCUMENTOS
  const handleDeleteDocument = async (tipoDocumento, index = null) => {
    if (!window.confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      // Primero eliminar de Firebase
      await eliminarDocumentoDeFirebase(tipoDocumento, index);
      
      // Después actualizar el estado local
      if (tipoDocumento === 'certificados' && index !== null) {
        setDocumentos(prev => ({
          ...prev,
          certificados: prev.certificados.filter((_, i) => i !== index)
        }));
      } else {
        setDocumentos(prev => ({
          ...prev,
          [tipoDocumento]: { url: '', nombre: '', fecha: '', vencimiento: '' }
        }));
      }

      setMessage({ 
        type: 'success', 
        text: '✅ Documento eliminado correctamente' 
      });
      showToast('✅ Documento eliminado', 'success');
      
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
      
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      setMessage({ 
        type: 'error', 
        text: '❌ Error al eliminar el documento' 
      });
    }
  };

  // 4. FUNCIÓN PARA ELIMINAR DE FIREBASE
  const eliminarDocumentoDeFirebase = async (tipoDocumento, index) => {
    try {
      if (!currentUser || !currentUser.uid) {
        throw new Error('No hay usuario autenticado');
      }

      if (tipoDocumento === 'certificados') {
        // Para certificados, obtener la lista actual y eliminar el específico
        const certificadosRef = ref(database, `trabajadores/${currentUser.uid}/documentos/certificados`);
        const snapshot = await get(certificadosRef);
        const certificadosData = snapshot.val() || {};
        
        const certificadosArray = Object.entries(certificadosData);
        if (index !== null && index < certificadosArray.length) {
          const [keyToDelete] = certificadosArray[index];
          const certRef = ref(database, `trabajadores/${currentUser.uid}/documentos/certificados/${keyToDelete}`);
          await set(certRef, null);
          console.log(`✅ Certificado ${keyToDelete} eliminado de Firebase`);
        }
      } else {
        // Para otros documentos, simplemente eliminar
        const docRef = ref(database, `trabajadores/${currentUser.uid}/documentos/${tipoDocumento}`);
        await set(docRef, null);
        console.log(`✅ ${tipoDocumento} eliminado de Firebase`);
      }
    } catch (error) {
      console.error('❌ Error al eliminar de Firebase:', error);
      throw error;
    }
  };

  // 5. FUNCIÓN CORREGIDA PARA CARGAR DOCUMENTOS DESDE FIREBASE
  const cargarDocumentosDesdeFirebase = async () => {
    if (!currentUser || !currentUser.uid) {
      console.log('⚠️ No hay usuario para cargar documentos');
      return null;
    }

    console.log('🔄 Iniciando carga de documentos para usuario:', currentUser.uid);
    setIsLoadingDocuments(true);
    
    try {
      // Primero verificar todas las rutas posibles
      const rutasPosibles = [
        `documentos/${currentUser.uid}`, // Primera prioridad (donde están tus documentos actuales)
        `trabajadores/${currentUser.uid}/documentos` // Segunda prioridad
      ];
      
      let data = null;
      let rutaEncontrada = null;
      
      // Buscar en todas las rutas hasta encontrar datos
      for (const ruta of rutasPosibles) {
        const testRef = ref(database, ruta);
        const snapshot = await get(testRef);
        const testData = snapshot.val();
        
        console.log(`📦 Verificando ruta ${ruta}:`, testData);
        
        if (testData && Object.keys(testData).length > 0) {
          data = testData;
          rutaEncontrada = ruta;
          console.log(`✅ Documentos encontrados en: ${ruta}`);
          break;
        }
      }
      
      // Si no se encontraron documentos en las rutas específicas, 
      // buscar en la estructura del trabajador
      if (!data) {
        const trabajadorRef = ref(database, `trabajadores/${currentUser.uid}`);
        const trabajadorSnapshot = await get(trabajadorRef);
        const trabajadorData = trabajadorSnapshot.val();
        
        console.log('👷 Datos del trabajador:', trabajadorData);
        
        if (trabajadorData?.documentos) {
          data = trabajadorData.documentos;
          rutaEncontrada = `trabajadores/${currentUser.uid}/documentos (dentro del objeto trabajador)`;
          console.log('✅ Documentos encontrados dentro del objeto trabajador');
        }
      }
      
      // Procesar los documentos encontrados
      if (data) {
        console.log('📄 Procesando documentos encontrados:', data);
        
        const docsToLoad = {
          licenciaConducir: data.licenciaConducir || { url: '', nombre: '', fecha: '', vencimiento: '' },
          certificadoOperador: data.certificadoOperador || { url: '', nombre: '', fecha: '', vencimiento: '' },
          certificados: []
        };
        
        // Procesar certificados si existen
        if (data.certificados && typeof data.certificados === 'object') {
          docsToLoad.certificados = Object.entries(data.certificados).map(([key, cert]) => ({
            firebaseKey: key,
            ...cert
          }));
        }
        
        console.log('✅ Documentos procesados:', docsToLoad);
        setDocumentos(docsToLoad);
      } else {
        console.log('⚠️ No se encontraron documentos en ninguna ruta');
      }
      
      // Establecer listeners para cambios en tiempo real en AMBAS rutas
      const listeners = [];
      
      // Listener para documentos/uid
      const docsRef1 = ref(database, `documentos/${currentUser.uid}`);
      const unsubscribe1 = onValue(docsRef1, (snapshot) => {
        const updatedData = snapshot.val();
        if (updatedData) {
          console.log('🔄 Actualización detectada en documentos/uid:', updatedData);
          
          const docsToUpdate = {
            licenciaConducir: updatedData.licenciaConducir || { url: '', nombre: '', fecha: '', vencimiento: '' },
            certificadoOperador: updatedData.certificadoOperador || { url: '', nombre: '', fecha: '', vencimiento: '' },
            certificados: []
          };
          
          if (updatedData.certificados && typeof updatedData.certificados === 'object') {
            docsToUpdate.certificados = Object.entries(updatedData.certificados).map(([key, cert]) => ({
              firebaseKey: key,
              ...cert
            }));
          }
          
          setDocumentos(docsToUpdate);
        }
      });
      listeners.push(unsubscribe1);
      
      // Listener para trabajadores/uid/documentos
      const docsRef2 = ref(database, `trabajadores/${currentUser.uid}/documentos`);
      const unsubscribe2 = onValue(docsRef2, (snapshot) => {
        const updatedData = snapshot.val();
        if (updatedData) {
          console.log('🔄 Actualización detectada en trabajadores/uid/documentos:', updatedData);
          
          const docsToUpdate = {
            licenciaConducir: updatedData.licenciaConducir || { url: '', nombre: '', fecha: '', vencimiento: '' },
            certificadoOperador: updatedData.certificadoOperador || { url: '', nombre: '', fecha: '', vencimiento: '' },
            certificados: []
          };
          
          if (updatedData.certificados && typeof updatedData.certificados === 'object') {
            docsToUpdate.certificados = Object.entries(updatedData.certificados).map(([key, cert]) => ({
              firebaseKey: key,
              ...cert
            }));
          }
          
          setDocumentos(docsToUpdate);
        }
      });
      listeners.push(unsubscribe2);
      
      setIsLoadingDocuments(false);
      
      // Retornar función para desuscribir todos los listeners
      return () => {
        listeners.forEach(unsubscribe => {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        });
      };
      
    } catch (error) {
      console.error('❌ Error al cargar documentos:', error);
      setIsLoadingDocuments(false);
      showToast('❌ Error al cargar documentos', 'error');
      return null;
    }
  };

  // 6. FUNCIÓN PARA FORMATEAR TAMAÑO DE ARCHIVO
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 7. USE EFFECT CORREGIDO PARA CARGAR DOCUMENTOS AL INICIAR
  useEffect(() => {
    let unsubscribe = null;
    let mounted = true;
    
    const loadDocuments = async () => {
      if (currentUser && currentUser.uid && mounted) {
        console.log('👤 Usuario detectado, cargando documentos:', currentUser.uid);
        
        // Esperar un poco más para asegurar que Firebase esté listo
        // y que el trabajador se haya registrado completamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (mounted) {
          unsubscribe = await cargarDocumentosDesdeFirebase();
          
          // Hacer una segunda verificación después de 2 segundos
          // por si los datos se guardaron justo después
          setTimeout(async () => {
            if (mounted && (!documentos.licenciaConducir?.url && !documentos.certificadoOperador?.url)) {
              console.log('🔄 Segunda verificación de documentos...');
              await cargarDocumentosDesdeFirebase();
            }
          }, 2000);
        }
      }
    };
    
    loadDocuments();
    
    return () => {
      mounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') {
        console.log('🔚 Desuscribiendo listener de documentos');
        unsubscribe();
      }
    };
  }, [currentUser?.uid]);

  // 8. USE EFFECT ADICIONAL PARA DEBUGGING
  useEffect(() => {
    if (showDocumentsModal && currentUser?.uid) {
      console.log('📂 Modal abierto, estado actual de documentos:', documentos);
      
      // Verificar directamente en Firebase cuando se abre el modal
      const checkFirebase = async () => {
        console.log('🔍 Iniciando verificación completa de Firebase...');
        
        // Verificar múltiples rutas posibles
        const rutas = [
          `trabajadores/${currentUser.uid}/documentos`,
          `documentos/${currentUser.uid}`,
          `usuarios/${currentUser.uid}/documentos`,
          `trabajadores/${currentUser.uid}`
        ];
        
        for (const ruta of rutas) {
          const testRef = ref(database, ruta);
          const snapshot = await get(testRef);
          const data = snapshot.val();
          if (data) {
            console.log(`✅ Datos encontrados en ${ruta}:`, data);
          } else {
            console.log(`❌ Sin datos en ${ruta}`);
          }
        }
        
        // Verificar la estructura completa de la base de datos
        console.log('📊 Verificando estructura completa...');
        const rootRef = ref(database);
        const rootSnapshot = await get(rootRef);
        const rootData = rootSnapshot.val();
        console.log('🗂️ Estructura raíz de la base de datos:', Object.keys(rootData || {}));
        
        // Si hay trabajadores, verificar su estructura
        if (rootData?.trabajadores?.[currentUser.uid]) {
          console.log('👤 Estructura del trabajador actual:', 
            Object.keys(rootData.trabajadores[currentUser.uid] || {}));
        }
      };
      
      checkFirebase();
    }
  }, [showDocumentsModal, currentUser?.uid]);

  // ========== RESTO DE LAS FUNCIONES DEL COMPONENTE ==========
  
  // Función para navegar al dashboard
  const navigateToDashboard = () => {
    if (onViewChange) {
      onViewChange('dashboard-trabajador');
    }
  };

  // Función para mostrar notificaciones tipo toast
  const showToast = (message, type = 'info', duration = 4000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    setToastNotification({ message, type });
    
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, duration);
  };

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cargar zonas asignadas
  useEffect(() => {
    if (currentUser && currentUser.uid) {
      const zonasRef = ref(database, 'zonas_asignadas');
      const unsubZonas = onValue(zonasRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const zonasArray = Object.entries(data)
            .filter(([id, zona]) => {
              return zona.trabajadorAsignado === currentUser.uid && zona.estado !== 'completado';
            })
            .map(([id, zona]) => ({
              id,
              ...zona
            }));
          
          setZonasAsignadas(zonasArray);
        } else {
          setZonasAsignadas([]);
        }
      });

      return () => unsubZonas();
    }
  }, [currentUser]);

  // Registrar trabajador
  useEffect(() => {
    if (currentUser && currentUser.uid) {
      console.log('🔄 Registrando trabajador en Firebase...');
      trabajadoresService.createOrUpdateTrabajador(currentUser.uid, {
        nombre: currentUser.name || currentUser.email || 'Trabajador',
        email: currentUser.email,
        telefono: currentUser.phone || '',
        vehicleId: currentUser.vehicleId || null,
        estado: 'disponible',
        rol: 'trabajador',
        ubicacion: null,
        createdAt: new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString()
      }).then(() => {
        console.log('✅ Trabajador registrado exitosamente');
      }).catch(error => {
        console.error('❌ Error al registrar trabajador:', error);
      });
    }
  }, [currentUser]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // ========== MODAL DE DOCUMENTOS MEJORADO ==========
  const DocumentosModal = () => {
    if (!showDocumentsModal) return null;

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
        alignItems: 'center',
        zIndex: 3000,
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '30px'
        }}>
          {/* Botón de DEBUG temporal - ELIMINAR EN PRODUCCIÓN */}
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#fee2e2',
            border: '2px dashed #dc2626',
            borderRadius: '8px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#991b1b' }}>
              🔧 Herramientas de Debug (Temporal)
            </h4>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={async () => {
                  console.log('=== INICIANDO DEBUG COMPLETO ===');
                  
                  // Buscar documentos en todas las rutas posibles
                  const rutas = [
                    'trabajadores',
                    'documentos', 
                    'usuarios',
                    'uploads'
                  ];
                  
                  for (const ruta of rutas) {
                    const testRef = ref(database, ruta);
                    const snapshot = await get(testRef);
                    const data = snapshot.val();
                    console.log(`📁 ${ruta}:`, data);
                  }
                  
                  // Buscar específicamente los documentos del usuario
                  const buscarDocumentos = async () => {
                    const rootRef = ref(database);
                    const snapshot = await get(rootRef);
                    const allData = snapshot.val();
                    
                    console.log('🔍 Buscando documentos con URLs de Cloudinary...');
                    
                    const buscarEnObjeto = (obj, path = '') => {
                      if (!obj) return;
                      
                      for (const [key, value] of Object.entries(obj)) {
                        const currentPath = path ? `${path}/${key}` : key;
                        
                        if (typeof value === 'string' && value.includes('cloudinary')) {
                          console.log(`✅ URL Cloudinary encontrada en ${currentPath}:`, value);
                        }
                        
                        if (typeof value === 'object' && value !== null) {
                          buscarEnObjeto(value, currentPath);
                        }
                      }
                    };
                    
                    buscarEnObjeto(allData);
                  };
                  
                  await buscarDocumentos();
                  alert('Revisa la consola para ver los resultados del debug');
                }}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                🔍 Buscar Documentos Perdidos
              </button>
              
              <button
                onClick={async () => {
                  // Forzar recarga de documentos
                  console.log('🔄 Forzando recarga...');
                  await cargarDocumentosDesdeFirebase();
                  alert('Documentos recargados - revisa la consola');
                }}
                style={{
                  padding: '8px 16px',
                  background: '#0891b2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                🔄 Forzar Recarga
              </button>
              
              <button
                onClick={() => {
                  console.log('📊 Estado actual:');
                  console.log('- Usuario:', currentUser);
                  console.log('- Documentos en estado:', documentos);
                  console.log('- UID:', currentUser?.uid);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📊 Ver Estado Actual
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '25px'
          }}>
            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '24px' }}>
              📄 Mis Documentos
            </h2>
            <button
              onClick={() => setShowDocumentsModal(false)}
              style={{
                padding: '8px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px'
              }}
            >
              ✖
            </button>
          </div>

          {/* Indicador de carga */}
          {isLoadingDocuments && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              <div>Cargando documentos...</div>
            </div>
          )}

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

          <div style={{
            padding: '15px',
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#92400e', fontSize: '16px' }}>
              📸 IMPORTANTE: Solo se aceptan IMÁGENES
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#78350f' }}>
              Los archivos PDF no están soportados. Si tienes documentos en PDF:
            </p>
            <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '14px', color: '#78350f' }}>
              <li>📱 Toma una <strong>FOTO</strong> del documento con tu celular</li>
              <li>💻 Haz una <strong>CAPTURA DE PANTALLA</strong> del PDF</li>
              <li>🔄 Convierte el PDF a JPG en: <a href="https://www.ilovepdf.com/pdf_to_jpg" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>iLovePDF.com</a></li>
            </ol>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {/* Licencia de Conducir */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '15px',
              background: documentos.licenciaConducir?.url ? '#f0fdf4' : 'white'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <h5 style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  🚗 Licencia de Conducir
                </h5>
                {documentos.licenciaConducir?.url && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: '#22c55e',
                    color: 'white',
                    borderRadius: '4px'
                  }}>
                    ✓ Cargado
                  </span>
                )}
              </div>
              
              {documentos.licenciaConducir?.url ? (
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
                      marginBottom: '3px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {documentos.licenciaConducir.nombre}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>
                      {documentos.licenciaConducir.fecha && 
                        new Date(documentos.licenciaConducir.fecha).toLocaleDateString('es-CL')}
                    </div>
                    {documentos.licenciaConducir.tamaño > 0 && (
                      <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                        {formatFileSize(documentos.licenciaConducir.tamaño)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a 
                      href={documentos.licenciaConducir.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#3b82f6',
                        color: 'white',
                        textAlign: 'center',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '12px'
                      }}
                    >
                      👁️ Ver
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument('licenciaConducir')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="licenciaConducir"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'licenciaConducir')}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="licenciaConducir"
                    style={{
                      display: 'block',
                      padding: '20px 10px',
                      background: '#f9fafb',
                      border: '2px dashed #d1d5db',
                      borderRadius: '6px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#6b7280',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                  >
                    {uploadProgress.licenciaConducir ? (
                      <div>
                        <div style={{ marginBottom: '5px' }}>
                          Subiendo... {uploadProgress.licenciaConducir}%
                        </div>
                        <div style={{
                          width: '100%',
                          height: '4px',
                          background: '#e5e7eb',
                          borderRadius: '2px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${uploadProgress.licenciaConducir}%`,
                            height: '100%',
                            background: '#3b82f6',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '20px', marginBottom: '5px' }}>📤</div>
                        <div>Click para subir</div>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Certificado de Operador */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '15px',
              background: documentos.certificadoOperador?.url ? '#f0fdf4' : 'white'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}>
                <h5 style={{ 
                  margin: 0, 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  🏗️ Certificado de Operador
                </h5>
                {documentos.certificadoOperador?.url && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: '#22c55e',
                    color: 'white',
                    borderRadius: '4px'
                  }}>
                    ✓ Cargado
                  </span>
                )}
              </div>
              
              {documentos.certificadoOperador?.url ? (
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
                      marginBottom: '3px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {documentos.certificadoOperador.nombre}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>
                      {documentos.certificadoOperador.fecha && 
                        new Date(documentos.certificadoOperador.fecha).toLocaleDateString('es-CL')}
                    </div>
                    {documentos.certificadoOperador.tamaño > 0 && (
                      <div style={{ color: '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
                        {formatFileSize(documentos.certificadoOperador.tamaño)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a 
                      href={documentos.certificadoOperador.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#3b82f6',
                        color: 'white',
                        textAlign: 'center',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '12px'
                      }}
                    >
                      👁️ Ver
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument('certificadoOperador')}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="certificadoOperador"
                    accept=".jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e.target.files[0], 'certificadoOperador')}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="certificadoOperador"
                    style={{
                      display: 'block',
                      padding: '20px 10px',
                      background: '#f9fafb',
                      border: '2px dashed #d1d5db',
                      borderRadius: '6px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#6b7280',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '5px' }}>📤</div>
                    <div>Click para subir</div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Sección de certificados adicionales */}
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
              📚 Certificados de Capacitación
            </h5>
            
            {documentos.certificados?.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                {documentos.certificados.map((cert, index) => (
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
                        color: '#1f2937',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        📜 {cert.nombre}
                      </div>
                      <div style={{ 
                        color: '#6b7280', 
                        fontSize: '11px',
                        marginTop: '2px' 
                      }}>
                        {formatFileSize(cert.tamaño)} • {cert.fecha && new Date(cert.fecha).toLocaleDateString('es-CL')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginLeft: '10px' }}>
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
                          fontSize: '11px'
                        }}
                      >
                        Ver
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument('certificados', index)}
                        style={{
                          padding: '4px 8px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div>
              <input
                type="file"
                id="certificados"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => handleFileUpload(e.target.files[0], 'certificados')}
                style={{ display: 'none' }}
                disabled={uploadingFile}
              />
              <label
                htmlFor="certificados"
                style={{
                  display: 'inline-block',
                  padding: '10px 16px',
                  background: uploadingFile ? '#9ca3af' : '#10b981',
                  color: 'white',
                  borderRadius: '6px',
                  cursor: uploadingFile ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {uploadingFile ? '⏳ Subiendo...' : '➕ Agregar Certificado'}
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RESTO DEL CÓDIGO (Estilos y return) SIN CAMBIOS...
  const styles = {
    container: {
      width: '100%',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden'
    },
    header: {
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: 'white',
      padding: '16px',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
    },
    headerContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    userInfo: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    userName: {
      fontSize: '20px',
      fontWeight: '700',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    logoutBtn: {
      padding: '8px 16px',
      background: 'rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    buttonGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px'
    },
    actionBtn: {
      padding: '16px',
      borderRadius: '12px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '15px',
      fontWeight: '600',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    mainContent: {
      padding: '20px',
      paddingTop: '30px'
    },
    dashboardGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px',
      marginBottom: '30px'
    },
    dashboardCard: {
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease'
    },
    cardIcon: {
      fontSize: '48px',
      marginBottom: '12px'
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '8px'
    },
    cardValue: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#3b82f6',
      marginBottom: '4px'
    },
    cardSubtext: {
      fontSize: '14px',
      color: '#6b7280'
    },
    zonasSection: {
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
      fontSize: '20px',
      fontWeight: '700',
      color: '#1f2937',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    zonaCard: {
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      border: '2px solid #e5e7eb',
      transition: 'all 0.3s ease'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px',
      color: '#6b7280'
    },
    toast: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 2000,
      animation: 'slideInRight 0.3s ease',
      maxWidth: '350px',
      backdropFilter: 'blur(10px)'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Mejorado para Móvil */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>
              <span>👷‍♂️</span>
              <span>{currentUser.name || 'Trabajador'}</span>
            </div>
            <button onClick={onLogout} style={styles.logoutBtn}>
              <span>🚪</span>
              <span>Salir</span>
            </button>
          </div>
          
          {/* Botones de Acción */}
          <div style={styles.buttonGrid}>
            <button
              onClick={() => setShowDocumentsModal(true)}
              style={{
                ...styles.actionBtn,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white'
              }}
            >
              <span style={{ fontSize: '24px' }}>📄</span>
              <span>Mis Documentos</span>
            </button>
            
            <button
              onClick={() => setShowVehiclePanel(true)}
              style={{
                ...styles.actionBtn,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: 'white'
              }}
            >
              <span style={{ fontSize: '24px' }}>🚛</span>
              <span>Mi Vehículo</span>
            </button>
            
            <button
              onClick={navigateToDashboard}
              style={{
                ...styles.actionBtn,
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white'
              }}
            >
              <span style={{ fontSize: '24px' }}>📊</span>
              <span>Dashboard</span>
            </button>
            
            <button
              onClick={() => showToast('🗺️ Función de mapa próximamente', 'info')}
              style={{
                ...styles.actionBtn,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white'
              }}
            >
              <span style={{ fontSize: '24px' }}>🗺️</span>
              <span>Mapa GPS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={styles.mainContent}>
        {/* Dashboard Cards */}
        <div style={styles.dashboardGrid}>
          <div style={styles.dashboardCard}>
            <div style={styles.cardIcon}>📍</div>
            <div style={styles.cardTitle}>Estado GPS</div>
            <div style={styles.cardValue}>
              {gpsStatus === 'active' ? 'Activo' : 'Inactivo'}
            </div>
            <div style={styles.cardSubtext}>
              {gpsStatus === 'active' ? '🟢 Transmitiendo ubicación' : '🔴 Sin transmisión'}
            </div>
          </div>

          <div style={styles.dashboardCard}>
            <div style={styles.cardIcon}>🏗️</div>
            <div style={styles.cardTitle}>Zonas Asignadas</div>
            <div style={styles.cardValue}>{zonasAsignadas.length}</div>
            <div style={styles.cardSubtext}>
              {zonasAsignadas.filter(z => z.estado === 'pendiente').length} pendientes
            </div>
          </div>

          <div style={styles.dashboardCard}>
            <div style={styles.cardIcon}>✅</div>
            <div style={styles.cardTitle}>Estado Actual</div>
            <div style={styles.cardValue}>Disponible</div>
            <div style={styles.cardSubtext}>Listo para trabajar</div>
          </div>
        </div>

        {/* Sección de Zonas */}
        <div style={styles.zonasSection}>
          <h2 style={styles.sectionTitle}>
            <span>🗺️</span>
            <span>Mis Zonas de Trabajo</span>
          </h2>
          
          {zonasAsignadas.length > 0 ? (
            <div>
              {zonasAsignadas.map(zona => (
                <div key={zona.id} style={styles.zonaCard}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                    📍 {zona.nombre}
                  </h3>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                    {zona.direccion}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 8px',
                      background: zona.prioridad === 'alta' ? '#dc2626' : 
                                zona.prioridad === 'media' ? '#f59e0b' : '#10b981',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      Prioridad: {zona.prioridad}
                    </span>
                    <span style={{
                      padding: '4px 8px',
                      background: zona.estado === 'pendiente' ? '#6b7280' :
                                zona.estado === 'en_progreso' ? '#3b82f6' : '#10b981',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {zona.estado === 'pendiente' ? '⏳ Pendiente' :
                       zona.estado === 'en_progreso' ? '🔧 En Progreso' : '✅ Completado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📭</div>
              <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                No tienes zonas asignadas
              </p>
              <p style={{ fontSize: '14px' }}>
                Cuando te asignen nuevas zonas aparecerán aquí
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastNotification && (
        <div style={{
          ...styles.toast,
          background: toastNotification.type === 'success' ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' :
                     toastNotification.type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                     toastNotification.type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                     'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white'
        }}>
          <span style={{ fontSize: '18px' }}>
            {toastNotification.type === 'success' ? '✅' :
             toastNotification.type === 'error' ? '❌' :
             toastNotification.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>
            {toastNotification.message}
          </span>
        </div>
      )}

      {/* Modal del panel de vehículo */}
      {showVehiclePanel && (
        <TrabajadorVehiclePanel 
          currentUser={currentUser}
          onClose={() => setShowVehiclePanel(false)}
        />
      )}

      {/* Modal de Documentos */}
      <DocumentosModal />

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
export default SistemaTrabajadoresFirebase;