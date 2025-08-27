// src/components/SuperAdmin.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { auth, firestore, database, storage, firebaseConfig } from '../config/firebase';
import { doc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import WelcomeScreen from './WelcomeScreen';
import NotificationSystem from './NotificationSystem';
import VehicleMaintenanceModule from './VehicleMaintenanceModule';
import PreventiveMaintenanceModule from './PreventiveMaintenanceModule';

import {
  ref as databaseRef,     // Alias para database ref
  set as databaseSet,     // Alias para database set
  push,
  update,
  remove,
  onValue,
  off
} from 'firebase/database';
import {
  ref as storageRef,      // Alias para storage ref
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { pdfExportService } from '../services/pdfExportService';
import { cloudinaryConfig } from '../config/cloudinary'; // Comenta si no usas Cloudinary aún

// COMPONENTE MODAL SEPARADO - FUERA DEL COMPONENTE PRINCIPAL
const TiposVehiculoModal = React.memo(({
  showTipoModal,
  setShowTipoModal,
  editingTipo,
  setEditingTipo,
  tipoFormData,
  setTipoFormData,
  handleSaveTipoVehiculo,
  handleEditTipo,
  handleDeleteTipoVehiculo,
  tiposVehiculo,
  vehiculos,
  loading,
  isMobile
}) => {
  if (!showTipoModal) return null;

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
      zIndex: 1000,
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px'
        }}>
          <h2 style={{ margin: 0, color: '#1f2937', fontSize: '24px' }}>
            ⚙️ Gestión de Tipos de Vehículos
          </h2>
          <button
            onClick={() => {
              setShowTipoModal(false);
              setEditingTipo(null);
              setTipoFormData({
                nombre: '',
                icon: '🚛',
                descripcion: '',
                categoria: 'general'
              });
            }}
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

        <div style={{
          background: '#f9fafb',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '25px'
        }}>
          <h3 style={{
            margin: '0 0 15px 0',
            color: '#374151',
            fontSize: '18px'
          }}>
            {editingTipo ? '✏️ Editar Tipo' : '➕ Crear Nuevo Tipo'}
          </h3>

          <form onSubmit={handleSaveTipoVehiculo}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '15px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Nombre del Tipo *
                </label>
                <input
                  type="text"
                  required
                  value={tipoFormData.nombre}
                  onChange={(e) => setTipoFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Retroexcavadora, Camión Tolva, etc."
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
                  Ícono
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    value={tipoFormData.icon}
                    onChange={(e) => setTipoFormData(prev => ({ ...prev, icon: e.target.value }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  >
                    <optgroup label="Vehículos">
                      <option value="🚗">🚗 Auto</option>
                      <option value="🚚">🚚 Camión</option>
                      <option value="🚛">🚛 Camión Grande</option>
                    </optgroup>
                    <optgroup label="Maquinaria">
                      <option value="🚜">🚜 Maquinaria Pesada</option>
                    </optgroup>
                  </select>
                  <div style={{
                    width: '50px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '24px'
                  }}>
                    {tipoFormData.icon}
                  </div>
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Categoría
                </label>
                <select
                  value={tipoFormData.categoria}
                  onChange={(e) => setTipoFormData(prev => ({ ...prev, categoria: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="general">General</option>
                  <option value="liviano">Vehículo Liviano</option>
                  <option value="pesado">Vehículo Pesado</option>
                  <option value="maquinaria">Maquinaria</option>
                  <option value="especial">Especial</option>
                  <option value="emergencia">Emergencia</option>
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
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  value={tipoFormData.descripcion}
                  onChange={(e) => setTipoFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción breve del tipo"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: loading ? '#9ca3af' : '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Guardando...' : editingTipo ? '✅ Actualizar' : '✅ Crear Tipo'}
              </button>

              {editingTipo && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTipo(null);
                    setTipoFormData({
                      nombre: '',
                      icon: '🚛',
                      descripcion: '',
                      categoria: 'general'
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar Edición
                </button>
              )}
            </div>
          </form>
        </div>

        <div>
          <h3 style={{
            margin: '0 0 15px 0',
            color: '#374151',
            fontSize: '18px'
          }}>
            📋 Tipos Existentes ({tiposVehiculo.length})
          </h3>

          {tiposVehiculo.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: '8px',
              color: '#6b7280'
            }}>
              <p style={{ fontSize: '16px', marginBottom: '10px' }}>
                No hay tipos de vehículos creados
              </p>
              <p style={{ fontSize: '14px' }}>
                Crea tu primer tipo usando el formulario de arriba
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '15px'
            }}>
              {tiposVehiculo.map(tipo => {
                const vehiculosConTipo = vehiculos.filter(v => v.tipo === tipo.id).length;

                return (
                  <div key={tipo.id} style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '15px',
                    position: 'relative'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '10px'
                    }}>
                      <span style={{ fontSize: '24px' }}>{tipo.icon}</span>
                      <div style={{ flex: 1 }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '16px',
                          color: '#1f2937'
                        }}>
                          {tipo.nombre}
                        </h4>
                        {tipo.categoria && (
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            background: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '4px'
                          }}>
                            {tipo.categoria}
                          </span>
                        )}
                      </div>
                    </div>

                    {tipo.descripcion && (
                      <p style={{
                        margin: '0 0 10px 0',
                        fontSize: '13px',
                        color: '#6b7280'
                      }}>
                        {tipo.descripcion}
                      </p>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '10px',
                      borderTop: '1px solid #f3f4f6'
                    }}>
                      <span style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {vehiculosConTipo} vehículo(s)
                      </span>

                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => handleEditTipo(tipo)}
                          style={{
                            padding: '6px 10px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTipoVehiculo(tipo)}
                          disabled={vehiculosConTipo > 0}
                          style={{
                            padding: '6px 10px',
                            background: vehiculosConTipo > 0 ? '#d1d5db' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: vehiculosConTipo > 0 ? 'not-allowed' : 'pointer',
                            opacity: vehiculosConTipo > 0 ? 0.5 : 1
                          }}
                          title={vehiculosConTipo > 0 ? 'No se puede eliminar, hay vehículos usando este tipo' : 'Eliminar tipo'}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const SuperAdmin = ({ currentUser, onLogout, onViewChange, currentView = 'admin' }) => {

  // ========== ESTADOS PARA USUARIOS ==========
  const [solicitudParaZona, setSolicitudParaZona] = useState(null);
  // En la línea ~90, actualiza el estado inicial de formData:
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'trabajador',
    phone: '',
    vehicleId: '',
    localidad: '',
    recoveryPin: '',
    rut: '',
    fotoPerfil: {
      url: '',
      publicId: '',
      fecha: ''
    },
    // REMOVER polizaSeguro de aquí
    licenciaConducir: '',
    licenciasConducir: [],
    fechaVencimientoLicencia: '',
    observacionesLicencia: '',
    licenciaBloqueada: false,
    motivoBloqueo: '',
    fechaBloqueo: ''
  });
  const [notificationCount, setNotificationCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('superAdminActiveTab');
    return savedTab || 'inicio'; // CAMBIAR de 'users' a 'inicio'
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('superAdminSidebarOpen');
    if (window.innerWidth <= 768) return false;
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [expandedMenus, setExpandedMenus] = useState(() => {
    const saved = localStorage.getItem('superAdminExpandedMenus');
    return saved ? JSON.parse(saved) : ['gestion'];
  });

  // Estado para mostrar/ocultar formularios con persistencia

  const [showCreateForm, setShowCreateForm] = useState(() => {
    const saved = localStorage.getItem('superAdminShowCreateForm');
    return saved ? JSON.parse(saved) : false;
  });

  const [showVehicleForm, setShowVehicleForm] = useState(() => {
    const saved = localStorage.getItem('superAdminShowVehicleForm');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobile, setIsMobile] = useState(false);
  const [showEditUserForm, setShowEditUserForm] = useState(false);

  // ========== ESTADOS PARA VEHÍCULOS ==========
  const [vehiculos, setVehiculos] = useState([]);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    // DATOS EXISTENTES
    nombre: '',
    tipo: '',
    marca: '',
    modelo: '',
    año: new Date().getFullYear(),
    patente: '',
    color: '',
    numeroChasis: '',
    numeroMotor: '',
    kilometraje: 0,
    capacidadCombustible: 0,
    tipoCombustible: 'gasolina',
    tipoAceite: '', // NUEVO: Tipo de aceite del motor
    fechaVencimientoExtintor: '', // NUEVO: Fecha de vencimiento del extintor
    imagenVehiculo: '', // NUEVO: URL de la imagen del vehículo
    seguroAdicional: '', // NUEVO: Información del seguro adicional/comercial
    companiaSeguroAdicional: '', // NUEVO: Compañía del seguro adicional
    numeroPolizaAdicional: '', // NUEVO: Número de póliza del seguro adicional
    vigenciaSeguroAdicional: '', // NUEVO: Vigencia del seguro adicional
    coberturaSeguroAdicional: '', // NUEVO: Tipo de cobertura
    ultimoMantenimiento: '',
    proximoMantenimiento: '',
    kilometrajeUltimoMantenimiento: 0,
    kilometrajeProximoMantenimiento: 0,
    fechaRevisionTecnica: '',
    fechaSeguro: '',
    fechaPermisoCirculacion: '',
    operadorAsignado: '',
    estado: 'disponible',
    lat: null,
    lng: null,
    observaciones: '',
    licenciasRequeridas: [],

    // NUEVOS CAMPOS - DATOS GENERALES
    vin: '',
    proveedor: '',
    modalidadAdquisicion: 'compra',
    valorAdquisicion: 0,
    fechaAdquisicion: '',

    // ESPECIFICACIONES TÉCNICAS
    cilindrada: '',
    potencia: '',
    transmision: 'manual',
    traccion: '4x2',
    capacidadPasajeros: 0,
    capacidadCarga: 0,
    pesoBrutoVehicular: 0,
    largo: 0,
    ancho: 0,
    alto: 0,
    numeroEjes: 2,
    equipamientoAdicional: '',

    // DOCUMENTACIÓN LEGAL
    numeroPermisoCirculacion: '',
    vigenciaPermisoCirculacion: '',
    fechaRevisionGases: '',
    resultadoRevisionTecnica: 'aprobado',
    vigenciaSOAP: '',
    numeroPolizaSOAP: '',
    seguroComplementario: false,
    numeroPolizaComplementario: '',
    vigenciaSeguroComplementario: '',
    multasRegistradas: '',
    documentos: {
      permisoCirculacion: { url: '', nombre: '', fecha: '' },
      revisionTecnica: { url: '', nombre: '', fecha: '' },
      certificadoGases: { url: '', nombre: '', fecha: '' },
      soap: { url: '', nombre: '', fecha: '' },
      seguroComplementario: { url: '', nombre: '', fecha: '' },
      padronMunicipal: { url: '', nombre: '', fecha: '' },
      facturaCompra: { url: '', nombre: '', fecha: '' },
      contratoLeasing: { url: '', nombre: '', fecha: '' },
      otros: []
    },
    polizaSeguroVehiculo: {
      url: '',
      nombre: '',
      fecha: '',
      publicId: '',
      numeroPoliza: '',
      vigencia: '',
      compania: '',
      cobertura: '',
      tipoSeguro: ''  // obligatorio o adicional
    },

    // CONTROL DE OPERACIÓN
    horasUso: 0,
    promedioUsoMensual: 0,
    consumoPromedio: 0,
    proveedorCombustible: '',
    tieneGPS: false,
    dispositivoGPS: '',

    // MANTENIMIENTO
    tallerMantenimiento: '',
    costoUltimoMantenimiento: 0,
    historialReparaciones: [],

    // COSTOS Y CICLO DE VIDA
    costoMantencionAcumulado: 0,
    costoCombustibleMensual: 0,
    costoCombustibleAnual: 0,
    costoSeguroAnual: 0,
    vidaUtilEstimada: 10,
    fechaEstimadaReemplazo: '',
    estadoPatrimonial: 'activo'
  });

  // ========== ESTADOS PARA TIPOS DE VEHÍCULOS DINÁMICOS ==========
  const [tiposVehiculo, setTiposVehiculo] = useState([]);
  const [showTipoModal, setShowTipoModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [tipoFormData, setTipoFormData] = useState({
    nombre: '',
    icon: '🚛',
    descripcion: '',
    categoria: 'general'
  });

  // ========== ESTADOS PARA SOLICITUDES ==========
  const [solicitudes, setSolicitudes] = useState([]);
  const [showSolicitudDetails, setShowSolicitudDetails] = useState(null);
  // NUEVO ESTADO: Para controlar la pantalla de bienvenida
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(() => {
    const welcomeShown = sessionStorage.getItem('superAdminWelcomeShown');
    return !welcomeShown;
  });
  // ========== FUNCIONES PARA MANEJO DE DOCUMENTOS ==========

  const handleFileUpload = async (file, tipoDocumento, vehiculoId) => {
    if (!file) return;

    // ⚠️ RECHAZAR PDFs COMPLETAMENTE
    if (file.type === 'application/pdf') {
      setMessage({
        type: 'error',
        text: '❌ NO se permiten PDFs. Por favor, sube una FOTO o IMAGEN del documento (JPG/PNG).'
      });

      // Mostrar alternativas
      alert(
        '📸 ALTERNATIVAS PARA SUBIR TU DOCUMENTO:\n\n' +
        '1. Toma una FOTO con tu celular\n' +
        '2. Haz una CAPTURA DE PANTALLA del PDF\n' +
        '3. Usa un escáner que guarde como JPG\n' +
        '4. Convierte el PDF a imagen en: https://www.ilovepdf.com/pdf_to_jpg'
      );

      return; // DETENER AQUÍ
    }

    // Solo aceptar imágenes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({
        type: 'error',
        text: '❌ Solo se permiten imágenes JPG y PNG'
      });
      return;
    }

    // Validar tamaño
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'vehiculos_docs');

      const vehicleId = vehiculoId || `temp_${Date.now()}`;
      const timestamp = Date.now();
      const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');

      formData.append('folder', `municipalidad/vehiculos/${vehicleId}/${tipoDocumento}`);
      formData.append('public_id', `${timestamp}_${cleanFileName}`);

      setUploadProgress({ [tipoDocumento]: 30 });

      // ✅ SIEMPRE subir como IMAGEN (nunca como raw)
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      setUploadProgress({ [tipoDocumento]: 60 });

      const data = await response.json();
      console.log('✅ Imagen subida:', data);

      setUploadProgress({ [tipoDocumento]: 90 });

      const documentData = {
        url: data.secure_url, // Las imágenes SÍ funcionan con HTTPS
        publicId: data.public_id,
        nombre: file.name,
        fecha: new Date().toISOString(),
        tamaño: file.size,
        tipo: file.type
      };

      // Actualizar estado
      if (tipoDocumento === 'otros') {
        setVehicleFormData(prev => ({
          ...prev,
          documentos: {
            ...prev.documentos,
            otros: [...(prev.documentos?.otros || []), documentData]
          }
        }));
      } else {
        setVehicleFormData(prev => ({
          ...prev,
          documentos: {
            ...prev.documentos,
            [tipoDocumento]: documentData
          }
        }));
      }

      setUploadProgress({ [tipoDocumento]: 100 });
      setMessage({
        type: 'success',
        text: `✅ ${file.name} subido exitosamente`
      });

      setTimeout(() => setUploadProgress({}), 1000);

    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al subir la imagen'
      });
    } finally {
      setUploadingFile(false);
    }
  };

  // Agregar después de handleFileUpload (alrededor de línea 450)
  const handleVehiclePolizaUpload = async (file) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({
        type: 'error',
        text: '❌ Solo se permiten imágenes JPG y PNG'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({
        type: 'error',
        text: '❌ El archivo no puede superar los 10MB'
      });
      return;
    }

    setUploadingFile(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('upload_preset', 'vehiculos_docs');

      const vehicleId = editingVehicle?.id || `temp_${Date.now()}`;
      const timestamp = Date.now();
      const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');

      uploadFormData.append('folder', `municipalidad/vehiculos/${vehicleId}/poliza`);
      uploadFormData.append('public_id', `${timestamp}_${cleanFileName}`);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: uploadFormData
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al subir archivo');
      }

      setVehicleFormData(prev => ({
        ...prev,
        polizaSeguroVehiculo: {
          ...prev.polizaSeguroVehiculo,
          url: data.secure_url,
          publicId: data.public_id,
          nombre: file.name,
          fecha: new Date().toISOString()
        }
      }));

      setMessage({
        type: 'success',
        text: '✅ Póliza de seguro subida exitosamente'
      });

    } catch (error) {
      console.error('Error al subir:', error);
      setMessage({
        type: 'error',
        text: `❌ Error al subir la imagen: ${error.message}`
      });
    } finally {
      setUploadingFile(false);
    }
  };
  const handleUserFileUpload = async (file, tipoDocumento, userId) => {
    if (!file) return;

    // Validaciones
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({
        type: 'error',
        text: '❌ Solo se permiten imágenes JPG y PNG'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage({
        type: 'error',
        text: '❌ El archivo no puede superar los 10MB'
      });
      return;
    }

    setUploadingFile(true);

    try {
      const uploadFormData = new FormData(); // CAMBIO: Renombrar para evitar conflicto
      uploadFormData.append('file', file);
      uploadFormData.append('upload_preset', 'vehiculos_docs'); // CAMBIO: Usar el mismo preset que ya funciona

      // CAMBIO: Usar el email del estado formData correctamente
      const userIdentifier = userId || formData.email || `temp_${Date.now()}`;
      const timestamp = Date.now();
      const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');

      uploadFormData.append('folder', `municipalidad/usuarios/${userIdentifier}/${tipoDocumento}`);
      uploadFormData.append('public_id', `${timestamp}_${cleanFileName}`);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
        {
          method: 'POST',
          body: uploadFormData // CAMBIO: Usar uploadFormData
        }
      );

      const data = await response.json();

      // AGREGAR: Verificar si la respuesta fue exitosa
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al subir archivo');
      }

      console.log('✅ Imagen subida:', data); // Debug

      if (tipoDocumento === 'fotoPerfil') {
        setFormData(prev => ({
          ...prev,
          fotoPerfil: {
            url: data.secure_url,
            publicId: data.public_id,
            fecha: new Date().toISOString()
          }
        }));
      } else if (tipoDocumento === 'polizaSeguro') {
        setFormData(prev => ({
          ...prev,
          polizaSeguro: {
            ...prev.polizaSeguro,
            url: data.secure_url,
            publicId: data.public_id,
            nombre: file.name,
            fecha: new Date().toISOString()
          }
        }));
      }

      setMessage({
        type: 'success',
        text: `✅ ${tipoDocumento === 'fotoPerfil' ? 'Foto de perfil' : 'Póliza'} subida exitosamente`
      });

    } catch (error) {
      console.error('Error al subir:', error);
      setMessage({
        type: 'error',
        text: `❌ Error al subir la imagen: ${error.message}`
      });
    } finally {
      setUploadingFile(false);
    }
  };

  // REEMPLAZA tu función handleDeleteDocument con esta:
  const handleDeleteDocument = async (tipoDocumento, index = null) => {
    if (!window.confirm('¿Estás seguro de eliminar este documento?')) return;

    try {
      let documentData;

      if (tipoDocumento === 'otros' && index !== null) {
        documentData = vehicleFormData.documentos.otros[index];
        // Eliminar del array
        setVehicleFormData(prev => ({
          ...prev,
          documentos: {
            ...prev.documentos,
            otros: prev.documentos.otros.filter((_, i) => i !== index)
          }
        }));
      } else {
        documentData = vehicleFormData.documentos[tipoDocumento];
        // Limpiar documento específico
        setVehicleFormData(prev => ({
          ...prev,
          documentos: {
            ...prev.documentos,
            [tipoDocumento]: { url: '', nombre: '', fecha: '' }
          }
        }));
      }

      setMessage({
        type: 'success',
        text: '✅ Documento eliminado'
      });

      // Nota: El archivo queda en Cloudinary pero sin referencia en tu BD
      console.log('Documento removido. Para eliminar de Cloudinary necesitas backend.');

    } catch (error) {
      console.error('Error al eliminar documento:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al eliminar el documento'
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // ========== DETECTAR SI ES MÓVIL ==========
  // ========== DETECTAR SI ES MÓVIL ==========
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ========== CARGAR DATOS INICIALES ==========
  // ========== CARGAR DATOS INICIALES ==========
  useEffect(() => {
    loadUsers();

    // Suscripciones a Firebase
    const unsubscribeVehiculos = loadVehiculos();
    const unsubscribeSolicitudes = loadSolicitudes();
    const unsubscribeTipos = loadTiposVehiculo();

    // Cleanup
    return () => {
      if (unsubscribeVehiculos) unsubscribeVehiculos();
      if (unsubscribeSolicitudes) unsubscribeSolicitudes();
      if (unsubscribeTipos) unsubscribeTipos();
    };
  }, []); // Solo ejecutar al montar

  // ========== PERSISTENCIA DE ESTADOS ==========



  // Guardar pestaña activa
  useEffect(() => {
    localStorage.setItem('superAdminActiveTab', activeTab);
  }, [activeTab]);

  // Guardar estado del sidebar (solo en desktop)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('superAdminSidebarOpen', JSON.stringify(isSidebarOpen));
    }
  }, [isSidebarOpen, isMobile]);

  // Guardar menús expandidos
  useEffect(() => {
    localStorage.setItem('superAdminExpandedMenus', JSON.stringify(expandedMenus));
  }, [expandedMenus]);

  // Guardar estado de formulario de creación
  useEffect(() => {
    localStorage.setItem('superAdminShowCreateForm', JSON.stringify(showCreateForm));
  }, [showCreateForm]);

  // Guardar estado de formulario de vehículos
  useEffect(() => {
    localStorage.setItem('superAdminShowVehicleForm', JSON.stringify(showVehicleForm));
  }, [showVehicleForm]);

  // ========== LIMPIAR LOCALSTORAGE AL DESMONTAR (OPCIONAL) ==========
  useEffect(() => {
    return () => {
      // Opcional: Si quieres limpiar cuando el componente se desmonta
      // Comenta estas líneas si quieres que persista incluso después de logout
      /*
      localStorage.removeItem('superAdminShowCreateForm');
      localStorage.removeItem('superAdminShowVehicleForm');
      */
    };
  }, []);

  // NUEVO USEEFFECT: Para marcar que ya se mostró la bienvenida
  useEffect(() => {
    if (!showWelcomeScreen) {
      sessionStorage.setItem('superAdminWelcomeShown', 'true');
    }
  }, [showWelcomeScreen]);

  // ========== FUNCIONES DE CARGA DE DATOS ==========
  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(firestore, 'users'));
      const usersList = [];

      usersSnapshot.forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        usersList.push(userData);
      });

      setUsers(usersList);

    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const loadVehiculos = useCallback(() => {
    const vehiculosRef = databaseRef(database, 'vehiculos');
    const unsubscribe = onValue(vehiculosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const vehiculosArray = Object.entries(data).map(([id, vehiculo]) => ({
          id,
          ...vehiculo
        }));

        // DEBUG: Ver si los documentos vienen de Firebase
        console.log('🚛 Vehículos cargados con documentos:', vehiculosArray);
        vehiculosArray.forEach(v => {
          if (v.documentos) {
            console.log(`📄 Documentos de ${v.nombre}:`, v.documentos);
          }
        });

        setVehiculos(vehiculosArray);
      } else {
        setVehiculos([]);
      }
    });

    return () => off(vehiculosRef);
  }, []);

  const loadSolicitudes = useCallback(() => {
    const solicitudesRef = databaseRef(database, 'solicitudes_maquinaria');
    const unsubscribe = onValue(solicitudesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const solicitudesArray = Object.entries(data)
          .map(([id, sol]) => ({ id, ...sol }))
          .sort((a, b) => {
            if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
            if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
            return new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud);
          });
        setSolicitudes(solicitudesArray);
      } else {
        setSolicitudes([]);
      }
    });

    return () => off(solicitudesRef);
  }, []);

  const loadTiposVehiculo = useCallback(() => {
    const tiposRef = databaseRef(database, 'tipos_vehiculo');
    const unsubscribe = onValue(tiposRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const tiposArray = Object.entries(data).map(([id, tipo]) => ({
          id,
          ...tipo
        }));
        setTiposVehiculo(tiposArray);
      } else {
        setTiposVehiculo([]);
      }
    });

    return () => off(tiposRef);
  }, []);

  // ========== FUNCIONES PARA TIPOS DE VEHÍCULOS - MEMOIZADAS ==========
  const handleSaveTipoVehiculo = useCallback(async (e) => {
    e.preventDefault();

    if (!tipoFormData.nombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre del tipo es requerido' });
      return;
    }

    setLoading(true);

    try {
      if (editingTipo) {
        const tipoRef = databaseRef(database, `tipos_vehiculo/${editingTipo.id}`);
        await update(tipoRef, {
          nombre: tipoFormData.nombre,
          icon: tipoFormData.icon,
          descripcion: tipoFormData.descripcion || '',
          categoria: tipoFormData.categoria || 'general',
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid
        });

        setMessage({
          type: 'success',
          text: `✅ Tipo "${tipoFormData.nombre}" actualizado exitosamente`
        });
      } else {
        const tipoId = tipoFormData.nombre.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');

        const tipoRef = databaseRef(database, `tipos_vehiculo/${tipoId}`);
        await databaseSet(tipoRef, {
          nombre: tipoFormData.nombre,
          icon: tipoFormData.icon,
          descripcion: tipoFormData.descripcion || '',
          categoria: tipoFormData.categoria || 'general',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.uid
        });

        setMessage({
          type: 'success',
          text: `✅ Tipo "${tipoFormData.nombre}" creado exitosamente`
        });
      }

      setTipoFormData({
        nombre: '',
        icon: '🚛',
        descripcion: '',
        categoria: 'general'
      });
      setEditingTipo(null);
      setShowTipoModal(false);

    } catch (error) {
      console.error('Error al guardar tipo:', error);
      setMessage({
        type: 'error',
        text: 'Error al guardar el tipo de vehículo'
      });
    } finally {
      setLoading(false);
    }
  }, [tipoFormData, editingTipo, currentUser.uid]);

  const handleDeleteTipoVehiculo = useCallback(async (tipo) => {
    const vehiculosConTipo = vehiculos.filter(v => v.tipo === tipo.id);

    if (vehiculosConTipo.length > 0) {
      setMessage({
        type: 'error',
        text: `❌ No se puede eliminar "${tipo.nombre}". Hay ${vehiculosConTipo.length} vehículo(s) usando este tipo`
      });
      return;
    }

    if (window.confirm(`¿Estás seguro de eliminar el tipo "${tipo.nombre}"?`)) {
      try {
        const tipoRef = databaseRef(database, `tipos_vehiculo/${tipo.id}`);
        await remove(tipoRef);

        setMessage({
          type: 'success',
          text: `✅ Tipo "${tipo.nombre}" eliminado exitosamente`
        });
      } catch (error) {
        console.error('Error al eliminar tipo:', error);
        setMessage({
          type: 'error',
          text: 'Error al eliminar el tipo de vehículo'
        });
      }
    }
  }, [vehiculos]);

  const handleEditTipo = useCallback((tipo) => {
    setEditingTipo(tipo);
    setTipoFormData({
      nombre: tipo.nombre,
      icon: tipo.icon || '🚛',
      descripcion: tipo.descripcion || '',
      categoria: tipo.categoria || 'general'
    });
    setShowTipoModal(true);
  }, []);

  // ========== FUNCIONES PARA SOLICITUDES ==========
  const handleResponseSolicitud = async (solicitudId, estado, respuesta) => {
    try {
      const solicitudRef = databaseRef(database, `solicitudes_maquinaria/${solicitudId}`);
      await update(solicitudRef, {
        estado,
        respuesta,
        fechaRespuesta: new Date().toISOString(),
        respondidoPor: currentUser.uid,
        visto: true
      });

      const solicitud = solicitudes.find(s => s.id === solicitudId);
      if (solicitud) {
        const notificacionRef = databaseRef(database, 'notificaciones');
        await push(notificacionRef, {
          tipo: 'respuesta_solicitud',
          mensaje: `Tu solicitud "${solicitud.asunto}" ha sido ${estado}`,
          destinatario: solicitud.solicitanteId,
          timestamp: new Date().toISOString(),
          leido: false
        });

        if (estado === 'aprobada') {
          setSolicitudParaZona(solicitud);
        }
      }

      setMessage({
        type: 'success',
        text: `✅ Solicitud ${estado} exitosamente`
      });
      setShowSolicitudDetails(null);

      if (estado === 'rechazada') {
        setSolicitudParaZona(null);
      }
    } catch (error) {
      console.error('Error al responder solicitud:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al procesar la solicitud'
      });
    }
  };

  const crearZonaDesdeSolicitud = () => {
    if (!solicitudParaZona) return;

    localStorage.setItem('solicitudParaZona', JSON.stringify({
      nombre: `Trabajo: ${solicitudParaZona.asunto}`,
      descripcion: `${solicitudParaZona.descripcion}\n\nSolicitante: ${solicitudParaZona.nombreSolicitante}\nTeléfono: ${solicitudParaZona.telefonoContacto}\nLocalidad: ${solicitudParaZona.localidad || 'No especificada'}`,
      direccion: `Solicitado por ${solicitudParaZona.localidad || 'Junta de Vecinos'}`,
      lat: solicitudParaZona.ubicacion.lat,
      lng: solicitudParaZona.ubicacion.lng,
      prioridad: solicitudParaZona.prioridad,
      fechaLimite: solicitudParaZona.fechaNecesaria,
      tipoMaquinaria: solicitudParaZona.tipoMaquinaria,
      duracionEstimada: solicitudParaZona.duracionEstimada,
      solicitudId: solicitudParaZona.id
    }));

    setSolicitudParaZona(null);
    onViewChange('zones');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    // Variables para la app secundaria
    let secondaryApp;
    let secondaryAuth;

    try {
      // Validar RUT
      if (!validarRUT(formData.rut)) {
        setMessage({ type: 'error', text: 'RUT inválido' });
        setLoading(false);
        return;
      }

      // CREAR APP SECUNDARIA TEMPORAL
      secondaryApp = initializeApp(firebaseConfig, `Secondary_${Date.now()}`);
      secondaryAuth = getSecondaryAuth(secondaryApp);

      // CREAR EL NUEVO USUARIO CON LA APP SECUNDARIA
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      );

      // Cerrar sesión en la app secundaria inmediatamente
      await secondarySignOut(secondaryAuth);

      // GUARDAR DATOS EN FIRESTORE CON FECHA DE VENCIMIENTO DE LICENCIA
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        email: formData.email,
        name: formData.name,
        role: formData.role,
        phone: formData.phone,
        vehicleId: formData.vehicleId || null,
        localidad: formData.localidad || null,
        recoveryPin: btoa(formData.recoveryPin),
        rut: formData.rut || null,
        licenciaConducir: formData.licenciaConducir || null, // Mantener por compatibilidad
        licenciasConducir: formData.licenciasConducir || [], // NUEVO: Array de licencias
        fechaVencimientoLicencia: formData.fechaVencimientoLicencia || null,
        observacionesLicencia: formData.observacionesLicencia || '', // NUEVO
        licenciaBloqueada: formData.licenciaBloqueada || false, // NUEVO
        motivoBloqueo: formData.motivoBloqueo || '', // NUEVO
        fechaBloqueo: formData.fechaBloqueo || '', // NUEVO
        fotoPerfil: formData.fotoPerfil || null,
        polizaSeguro: formData.polizaSeguro || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        active: true,
        firstLogin: true
      });

      // SINCRONIZACIÓN CON REALTIME DATABASE PARA TRABAJADORES
      if (formData.role === 'trabajador') {
        console.log('🔄 Sincronizando trabajador en Realtime Database...');

        const trabajadorRef = databaseRef(database, `trabajadores/${userCredential.user.uid}`);
        await databaseSet(trabajadorRef, {
          nombre: formData.name,
          email: formData.email,
          telefono: formData.phone || '',
          rut: formData.rut || null,
          vehiculoAsignado: formData.vehicleId || null,
          estado: 'disponible',
          licenciaConducir: formData.licenciaConducir || null,
          licenciasConducir: formData.licenciasConducir || [],
          fechaVencimientoLicencia: formData.fechaVencimientoLicencia || null,
          observacionesLicencia: formData.observacionesLicencia || '',
          licenciaBloqueada: formData.licenciaBloqueada || false,
          motivoBloqueo: formData.motivoBloqueo || '',
          fechaBloqueo: formData.fechaBloqueo || '',
          ubicacion: null, // Inicialmente sin ubicación GPS
          ultimoTrabajo: null,
          zonaDestino: null,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.uid
        });

        console.log('✅ Trabajador sincronizado en Realtime Database');
      }

      // Si se asignó un vehículo, actualizar el vehículo también
      if (formData.vehicleId && formData.role === 'trabajador') {
        const vehiculoRef = databaseRef(database, `vehiculos/${formData.vehicleId}`);
        await update(vehiculoRef, {
          operadorAsignado: userCredential.user.uid,
          ultimaActualizacion: new Date().toISOString(),
          actualizadoPor: currentUser.uid
        });

        console.log('✅ Vehículo actualizado con operador asignado');
      }

      // Mensaje de éxito
      setMessage({
        type: 'success',
        text: `✅ Usuario ${formData.name} creado exitosamente${formData.role === 'trabajador' ? ' y sincronizado en panel de flota' : ''}`
      });

      // Resetear formulario
      // En el reseteo del formulario después de crear usuario exitosamente
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'trabajador',
        phone: '',
        vehicleId: '',
        localidad: '',
        recoveryPin: '',
        rut: '',
        licenciaConducir: '',
        licenciasConducir: [],
        fechaVencimientoLicencia: '',
        observacionesLicencia: '',
        licenciaBloqueada: false,
        motivoBloqueo: '',
        fechaBloqueo: '',
        // AGREGAR:
        fotoPerfil: {
          url: '',
          publicId: '',
          fecha: ''
        },
        polizaSeguro: {
          url: '',
          nombre: '',
          fecha: '',
          publicId: '',
          numeroPoliza: '',
          vigencia: '',
          compania: '',
          cobertura: ''
        }
      });

      // Recargar lista de usuarios
      loadUsers();
      setShowCreateForm(false);

    } catch (error) {
      console.error('Error al crear usuario:', error);

      // Manejo de errores específicos
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
        case 'auth/network-request-failed':
          errorMessage = 'Error de conexión. Verifica tu internet';
          break;
        default:
          errorMessage = error.message;
      }

      setMessage({ type: 'error', text: errorMessage });

    } finally {
      // MUY IMPORTANTE: Limpiar la app secundaria
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setLoading(false);
    }
  };

  // ========================================================
  // OPCIONAL: Si también quieres actualizar handleUpdateUser
  // para cambiar contraseñas sin perder sesión
  // ========================================================

  const handleResetUserPassword = async (userId, userEmail, newPassword) => {
    let secondaryApp;
    let secondaryAuth;

    try {
      // Crear app secundaria
      secondaryApp = initializeApp(firebaseConfig, `Secondary_Reset_${Date.now()}`);
      secondaryAuth = getSecondaryAuth(secondaryApp);

      // Aquí podrías implementar lógica para resetear contraseña
      // usando Firebase Admin SDK (requiere backend) o
      // simplemente actualizar la contraseña temporal en Firestore

      // Opción simple: Guardar nueva contraseña temporal
      await updateDoc(doc(firestore, 'users', userId), {
        tempPassword: btoa(newPassword),
        requirePasswordChange: true,
        needsAuthSync: true,
        passwordResetAt: new Date().toISOString(),
        passwordResetBy: currentUser.uid
      });

      setMessage({
        type: 'success',
        text: `✅ Contraseña reseteada para ${userEmail}. El usuario deberá cambiarla en su próximo inicio de sesión.`
      });

    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      setMessage({
        type: 'error',
        text: 'Error al resetear la contraseña'
      });
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role || 'trabajador',
      phone: user.phone || '',
      vehicleId: user.vehicleId || '',
      localidad: user.localidad || '',
      recoveryPin: '', // No mostrar el PIN actual por seguridad
      rut: user.rut || '',
      licenciaConducir: user.licenciaConducir || '', // Mantener por compatibilidad
      licenciasConducir: user.licenciasConducir || [], // CARGAR ARRAY DE LICENCIAS
      fechaVencimientoLicencia: user.fechaVencimientoLicencia || '',
      observacionesLicencia: user.observacionesLicencia || '',

      fotoPerfil: user.fotoPerfil || { url: '', publicId: '', fecha: '' },
      polizaSeguro: user.polizaSeguro || {
        url: '',
        nombre: '',
        fecha: '',
        publicId: '',
        numeroPoliza: '',
        vigencia: '',
        compania: '',
        cobertura: ''
      },
      licenciaBloqueada: user.licenciaBloqueada || false,
      motivoBloqueo: user.motivoBloqueo || '',
      fechaBloqueo: user.fechaBloqueo || ''
    });
    setShowEditUserForm(true);
    setShowCreateForm(false);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validar RUT si se proporciona
      if (formData.rut && !validarRUT(formData.rut)) {
        setMessage({ type: 'error', text: 'RUT inválido' });
        setLoading(false);
        return;
      }

      const updateData = {
        name: formData.name,
        role: formData.role,
        phone: formData.phone,
        vehicleId: formData.vehicleId || null,
        localidad: formData.localidad || null,
        rut: formData.rut || null,
        licenciaConducir: formData.licenciaConducir || null, // Mantener por compatibilidad
        licenciasConducir: formData.licenciasConducir || [], // ACTUALIZAR ARRAY
        fechaVencimientoLicencia: formData.fechaVencimientoLicencia || null,
        observacionesLicencia: formData.observacionesLicencia || '',
        licenciaBloqueada: formData.licenciaBloqueada || false,
        motivoBloqueo: formData.motivoBloqueo || '',
        fechaBloqueo: formData.fechaBloqueo || '',
        fotoPerfil: formData.fotoPerfil || null,
        polizaSeguro: formData.polizaSeguro || null,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.uid
      };

      // Solo actualizar el PIN si se proporcionó uno nuevo
      if (formData.recoveryPin && formData.recoveryPin.length === 4) {
        updateData.recoveryPin = btoa(formData.recoveryPin);
      }

      await updateDoc(doc(firestore, 'users', editingUser.id), updateData);

      setMessage({
        type: 'success',
        text: `✅ Usuario ${formData.name} actualizado exitosamente`
      });

      // Resetear formulario
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'trabajador',
        phone: '',
        vehicleId: '',
        localidad: '',
        recoveryPin: '',
        rut: '',
        licenciaConducir: '',
        fechaVencimientoLicencia: '' // RESETEAR NUEVO CAMPO
      });

      loadUsers();
      setShowEditUserForm(false);
      setEditingUser(null);

    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      setMessage({ type: 'error', text: 'Error al actualizar usuario: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('¿Estás seguro de eliminar este usuario?')) {
      try {
        await deleteDoc(doc(firestore, 'users', userId));
        setMessage({ type: 'success', text: '✅ Usuario eliminado' });
        loadUsers();
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al eliminar usuario' });
      }
    }
  };

  const handleCreateOrUpdateVehicle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const estadoValido = ['disponible', 'en_uso', 'mantenimiento', 'fuera_servicio'].includes(vehicleFormData.estado)
        ? vehicleFormData.estado
        : 'disponible';

      // Preparar datos del vehículo
      const vehicleDataToSave = {
        // Campos básicos
        nombre: vehicleFormData.nombre || '',
        tipo: vehicleFormData.tipo || '',
        marca: vehicleFormData.marca || '',
        modelo: vehicleFormData.modelo || '',
        año: vehicleFormData.año || new Date().getFullYear(),
        patente: vehicleFormData.patente || '',
        color: vehicleFormData.color || '',
        numeroChasis: vehicleFormData.numeroChasis || '',
        numeroMotor: vehicleFormData.numeroMotor || '',
        kilometraje: vehicleFormData.kilometraje || 0,
        capacidadCombustible: vehicleFormData.capacidadCombustible || 0,
        tipoCombustible: vehicleFormData.tipoCombustible || 'gasolina',
        estado: estadoValido,
        licenciasRequeridas: vehicleFormData.licenciasRequeridas || [],
        polizaSeguroVehiculo: vehicleFormData.polizaSeguroVehiculo || null,

        // Mantenimiento
        ultimoMantenimiento: vehicleFormData.ultimoMantenimiento || '',
        proximoMantenimiento: vehicleFormData.proximoMantenimiento || '',
        kilometrajeUltimoMantenimiento: vehicleFormData.kilometrajeUltimoMantenimiento || 0,
        kilometrajeProximoMantenimiento: vehicleFormData.kilometrajeProximoMantenimiento || 0,

        // Documentación
        fechaRevisionTecnica: vehicleFormData.fechaRevisionTecnica || '',
        fechaSeguro: vehicleFormData.fechaSeguro || '',
        fechaPermisoCirculacion: vehicleFormData.fechaPermisoCirculacion || '',

        // Ubicación
        lat: vehicleFormData.lat || null,
        lng: vehicleFormData.lng || null,

        // Observaciones
        observaciones: vehicleFormData.observaciones || '',

        // Timestamps
        ultimaActualizacion: new Date().toISOString(),
        actualizadoPor: currentUser.uid
      };

      // ⚠️ IMPORTANTE: INCLUIR DOCUMENTOS SI EXISTEN
      if (vehicleFormData.documentos) {
        const documentosParaGuardar = {};

        // Guardar cada tipo de documento
        Object.keys(vehicleFormData.documentos).forEach(tipoDoc => {
          const doc = vehicleFormData.documentos[tipoDoc];

          if (tipoDoc === 'otros' && Array.isArray(doc) && doc.length > 0) {
            // Para array de otros documentos
            documentosParaGuardar.otros = doc.map(d => ({
              url: d.url || '',
              nombre: d.nombre || '',
              fecha: d.fecha || '',
              publicId: d.publicId || '',
              tamaño: d.tamaño || 0,
              tipo: d.tipo || ''
            }));
          } else if (doc && doc.url) {
            // Para documentos individuales con URL
            documentosParaGuardar[tipoDoc] = {
              url: doc.url || '',
              nombre: doc.nombre || '',
              fecha: doc.fecha || '',
              publicId: doc.publicId || '',
              tamaño: doc.tamaño || 0,
              tipo: doc.tipo || ''
            };
          }
        });

        // Solo agregar documentos si hay alguno
        if (Object.keys(documentosParaGuardar).length > 0) {
          vehicleDataToSave.documentos = documentosParaGuardar;
          console.log('📄 Guardando documentos:', documentosParaGuardar);
        }
      }

      // Agregar otros campos nuevos si están presentes
      if (vehicleFormData.vin) vehicleDataToSave.vin = vehicleFormData.vin;
      if (vehicleFormData.proveedor) vehicleDataToSave.proveedor = vehicleFormData.proveedor;
      // ... agregar más campos según necesites

      console.log('💾 Datos a guardar:', vehicleDataToSave);

      if (editingVehicle) {
        // ACTUALIZAR vehículo existente
        const vehicleRef = databaseRef(database, `vehiculos/${editingVehicle.id}`);
        await update(vehicleRef, vehicleDataToSave);

        setMessage({
          type: 'success',
          text: `✅ Vehículo ${vehicleFormData.nombre} actualizado exitosamente`
        });
      } else {
        // CREAR nuevo vehículo
        vehicleDataToSave.createdAt = new Date().toISOString();
        vehicleDataToSave.createdBy = currentUser.uid;

        const vehiculosRef = databaseRef(database, 'vehiculos');
        const newVehicleRef = push(vehiculosRef);
        await databaseSet(newVehicleRef, vehicleDataToSave);

        setMessage({
          type: 'success',
          text: `✅ Vehículo ${vehicleFormData.nombre} creado exitosamente`
        });
      }


      // Al resetear el formulario, siempre incluir estructura de documentos
      const resetVehicleForm = () => {
        setVehicleFormData({
          nombre: '',
          tipo: '',
          marca: '',
          modelo: '',
          año: new Date().getFullYear(),
          patente: '',
          color: '',
          numeroChasis: '',
          numeroMotor: '',
          kilometraje: 0,
          capacidadCombustible: 0,
          tipoCombustible: 'gasolina',
          ultimoMantenimiento: '',
          proximoMantenimiento: '',
          kilometrajeUltimoMantenimiento: 0,
          kilometrajeProximoMantenimiento: 0,
          fechaRevisionTecnica: '',
          fechaSeguro: '',
          fechaPermisoCirculacion: '',
          operadorAsignado: '',
          estado: 'disponible',
          lat: null,
          lng: null,
          observaciones: '',

          // IMPORTANTE: Siempre incluir estructura de documentos
          documentos: {
            permisoCirculacion: { url: '', nombre: '', fecha: '' },
            revisionTecnica: { url: '', nombre: '', fecha: '' },
            certificadoGases: { url: '', nombre: '', fecha: '' },
            soap: { url: '', nombre: '', fecha: '' },
            seguroComplementario: { url: '', nombre: '', fecha: '' },
            padronMunicipal: { url: '', nombre: '', fecha: '' },
            facturaCompra: { url: '', nombre: '', fecha: '' },
            contratoLeasing: { url: '', nombre: '', fecha: '' },
            otros: []
          },

          // ... resto de campos
        });
      };


      setShowVehicleForm(false);
      setEditingVehicle(null);

    } catch (error) {
      console.error('Error al guardar vehículo:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al guardar el vehículo: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };
  // Función para validar RUT chileno
  const validarRUT = (rut) => {
    // Limpiar RUT
    const rutLimpio = rut.replace(/[^0-9kK]/g, '').toUpperCase();

    if (rutLimpio.length < 8 || rutLimpio.length > 9) {
      return false;
    }

    const cuerpo = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1);

    // Calcular dígito verificador
    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
      suma += parseInt(cuerpo[i]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const dvCalculado = 11 - (suma % 11);
    const dvFinal = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : dvCalculado.toString();

    return dv === dvFinal;
  };

  // Función para formatear RUT mientras se escribe
  const formatearRUT = (value) => {
    // Eliminar caracteres no válidos
    let rut = value.replace(/[^0-9kK]/g, '').toUpperCase();

    // Limitar longitud
    if (rut.length > 9) {
      rut = rut.slice(0, 9);
    }

    // Si tiene más de 1 carácter, formatear
    if (rut.length > 1) {
      // Separar dígito verificador
      const dv = rut.slice(-1);
      let cuerpo = rut.slice(0, -1);

      // Agregar puntos cada 3 dígitos
      cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

      // Unir cuerpo y dígito verificador con guión
      rut = `${cuerpo}-${dv}`;
    }

    return rut;
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleFormData({
      // Campos existentes
      nombre: vehicle.nombre || '',
      tipo: vehicle.tipo || '',
      marca: vehicle.marca || '',
      modelo: vehicle.modelo || '',
      año: vehicle.año || new Date().getFullYear(),
      patente: vehicle.patente || '',
      color: vehicle.color || '',
      numeroChasis: vehicle.numeroChasis || '',
      numeroMotor: vehicle.numeroMotor || '',
      kilometraje: vehicle.kilometraje || 0,
      capacidadCombustible: vehicle.capacidadCombustible || 0,
      tipoCombustible: vehicle.tipoCombustible || 'gasolina',
      ultimoMantenimiento: vehicle.ultimoMantenimiento || '',
      proximoMantenimiento: vehicle.proximoMantenimiento || '',
      kilometrajeUltimoMantenimiento: vehicle.kilometrajeUltimoMantenimiento || 0,
      kilometrajeProximoMantenimiento: vehicle.kilometrajeProximoMantenimiento || 0,
      fechaRevisionTecnica: vehicle.fechaRevisionTecnica || '',
      fechaSeguro: vehicle.fechaSeguro || '',
      fechaPermisoCirculacion: vehicle.fechaPermisoCirculacion || '',
      operadorAsignado: vehicle.operadorAsignado || '',
      estado: vehicle.estado || 'disponible',
      lat: vehicle.lat || null,
      lng: vehicle.lng || null,
      observaciones: vehicle.observaciones || '',
      licenciasRequeridas: vehicle.licenciasRequeridas || [],

      // ⚠️ IMPORTANTE: CARGAR DOCUMENTOS EXISTENTES
      documentos: {
        permisoCirculacion: { url: '', nombre: '', fecha: '' },
        revisionTecnica: { url: '', nombre: '', fecha: '' },
        certificadoGases: { url: '', nombre: '', fecha: '' },
        soap: { url: '', nombre: '', fecha: '' },
        seguroComplementario: { url: '', nombre: '', fecha: '' },
        padronMunicipal: { url: '', nombre: '', fecha: '' },
        facturaCompra: { url: '', nombre: '', fecha: '' },
        contratoLeasing: { url: '', nombre: '', fecha: '' },
        extintor: { url: '', nombre: '', fecha: '' }, // AGREGAR ESTA LÍNEA
        otros: []
      },

      // Nuevos campos
      vin: vehicle.vin || '',
      proveedor: vehicle.proveedor || '',
      modalidadAdquisicion: vehicle.modalidadAdquisicion || 'compra',
      valorAdquisicion: vehicle.valorAdquisicion || 0,
      fechaAdquisicion: vehicle.fechaAdquisicion || '',
      cilindrada: vehicle.cilindrada || '',
      potencia: vehicle.potencia || '',
      transmision: vehicle.transmision || 'manual',
      traccion: vehicle.traccion || '4x2',
      capacidadPasajeros: vehicle.capacidadPasajeros || 0,
      capacidadCarga: vehicle.capacidadCarga || 0,
      pesoBrutoVehicular: vehicle.pesoBrutoVehicular || 0,
      largo: vehicle.largo || 0,
      ancho: vehicle.ancho || 0,
      alto: vehicle.alto || 0,
      numeroEjes: vehicle.numeroEjes || 2,
      equipamientoAdicional: vehicle.equipamientoAdicional || '',
      numeroPermisoCirculacion: vehicle.numeroPermisoCirculacion || '',
      vigenciaPermisoCirculacion: vehicle.vigenciaPermisoCirculacion || '',
      fechaRevisionGases: vehicle.fechaRevisionGases || '',
      resultadoRevisionTecnica: vehicle.resultadoRevisionTecnica || 'aprobado',
      vigenciaSOAP: vehicle.vigenciaSOAP || '',
      numeroPolizaSOAP: vehicle.numeroPolizaSOAP || '',
      seguroComplementario: vehicle.seguroComplementario || false,
      numeroPolizaComplementario: vehicle.numeroPolizaComplementario || '',
      vigenciaSeguroComplementario: vehicle.vigenciaSeguroComplementario || '',
      multasRegistradas: vehicle.multasRegistradas || '',
      horasUso: vehicle.horasUso || 0,
      promedioUsoMensual: vehicle.promedioUsoMensual || 0,
      consumoPromedio: vehicle.consumoPromedio || 0,
      proveedorCombustible: vehicle.proveedorCombustible || '',
      tieneGPS: vehicle.tieneGPS || false,
      dispositivoGPS: vehicle.dispositivoGPS || '',
      tallerMantenimiento: vehicle.tallerMantenimiento || '',
      costoUltimoMantenimiento: vehicle.costoUltimoMantenimiento || 0,
      historialReparaciones: vehicle.historialReparaciones || [],
      costoMantencionAcumulado: vehicle.costoMantencionAcumulado || 0,
      costoCombustibleMensual: vehicle.costoCombustibleMensual || 0,
      costoCombustibleAnual: vehicle.costoCombustibleAnual || 0,
      costoSeguroAnual: vehicle.costoSeguroAnual || 0,
      vidaUtilEstimada: vehicle.vidaUtilEstimada || 10,
      fechaEstimadaReemplazo: vehicle.fechaEstimadaReemplazo || '',
      estadoPatrimonial: vehicle.estadoPatrimonial || 'activo'
    });
    setShowVehicleForm(true);
  };

  const handleQuickMaintenanceToggle = async (vehiculo) => {
    try {
      const nuevoEstado = vehiculo.estado === 'mantenimiento' ? 'disponible' : 'mantenimiento';
      const vehicleRef = databaseRef(database, `vehiculos/${vehiculo.id}`);

      const updateData = {
        estado: nuevoEstado,
        ultimaActualizacion: new Date().toISOString(),
        fechaMantenimiento: nuevoEstado === 'mantenimiento' ? new Date().toISOString() : null
      };

      await update(vehicleRef, updateData);

      setMessage({
        type: 'success',
        text: `✅ Vehículo ${vehiculo.nombre} marcado como ${nuevoEstado === 'mantenimiento' ? 'En Mantenimiento 🔧' : 'Disponible ✅'}`
      });

    } catch (error) {
      console.error('Error al cambiar estado:', error);
      setMessage({ type: 'error', text: 'Error al cambiar estado del vehículo' });
    }
  };

  const handleCompleteMaintenance = async (vehiculo) => {
    try {
      const hoy = new Date();
      const hoyFormateado = hoy.toISOString().split('T')[0];
      const kilometrajeActual = vehiculo.kilometraje || 0;

      const proximaFecha = new Date();
      proximaFecha.setMonth(proximaFecha.getMonth() + 3);
      const proximoKm = kilometrajeActual + 5000;

      const vehicleRef = databaseRef(database, `vehiculos/${vehiculo.id}`);
      const updateData = {
        estado: 'disponible',
        ultimoMantenimiento: hoyFormateado,
        kilometrajeUltimoMantenimiento: kilometrajeActual,
        proximoMantenimiento: proximaFecha.toISOString().split('T')[0],
        kilometrajeProximoMantenimiento: proximoKm,
        ultimaActualizacion: new Date().toISOString(),
        fechaMantenimiento: null
      };

      await update(vehicleRef, updateData);

      setMessage({
        type: 'success',
        text: `✅ Mantenimiento completado para ${vehiculo.nombre}. Próximo mantenimiento: ${proximaFecha.toLocaleDateString('es-CL')} o ${proximoKm.toLocaleString()} km`
      });

    } catch (error) {
      console.error('Error al completar mantenimiento:', error);
      setMessage({ type: 'error', text: 'Error al completar el mantenimiento' });
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('¿Estás seguro de eliminar este vehículo? Esta acción no se puede deshacer.')) {
      try {
        const vehicleRef = databaseRef(database, `vehiculos/${vehicleId}`);
        await remove(vehicleRef);
        setMessage({ type: 'success', text: '✅ Vehículo eliminado exitosamente' });
      } catch (error) {
        setMessage({ type: 'error', text: 'Error al eliminar el vehículo' });
      }
    }
  };

  // ========== FUNCIONES DE ESTADÍSTICAS ==========
  const getUserStats = () => {
    const stats = {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      trabajadores: users.filter(u => u.role === 'trabajador').length,
      superadmins: users.filter(u => u.role === 'superadmin').length,
      monitores: users.filter(u => u.role === 'monitor').length // AGREGAR ESTA LÍNEA
    };
    return stats;
  };
  const getVehicleStats = () => {
    const stats = {
      total: vehiculos.length,
      disponibles: vehiculos.filter(v => v.estado === 'disponible').length,
      enUso: vehiculos.filter(v => v.estado === 'en_uso').length,
      mantenimiento: vehiculos.filter(v => v.estado === 'mantenimiento').length,
      activos: vehiculos.filter(v => v.estado === 'disponible' || v.estado === 'en_uso').length,
      fueraServicio: vehiculos.filter(v => v.estado === 'fuera_servicio').length
    };
    return stats;
  };

  // ========== FUNCIONES DEL SIDEBAR ==========
  const toggleMenu = (menuId) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };
  const handleExportUsersPDF = () => {
    setMessage({ type: 'info', text: 'Generando PDF de usuarios...' });

    try {
      pdfExportService.exportUsersToPDF(users, currentUser);
      setMessage({
        type: 'success',
        text: '✅ PDF de usuarios generado exitosamente'
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al generar el PDF'
      });
    }
  };
  // Función para exportar un usuario individual a PDF
  // AGREGAR CONSOLE.LOG PARA DEBUGGING
  const handleExportSingleUserPDF = (user) => {
    // DEBUGGING: Ver qué datos tiene el usuario
    console.log('Usuario a exportar:', user);
    console.log('Datos del usuario:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      localidad: user.localidad,
      active: user.active
    });

    if (!user || !user.email) {
      setMessage({
        type: 'error',
        text: '❌ Error: Datos del usuario incompletos'
      });
      return;
    }

    try {
      // Asegurarse de pasar el objeto completo
      pdfExportService.exportSingleUserToPDF(user, currentUser);

      setMessage({
        type: 'success',
        text: `✅ PDF de ${user.name || user.email} generado`
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al generar el PDF'
      });
    }
  };

  const handleExportVehiclesPDF = () => {
    setMessage({ type: 'info', text: 'Generando PDF de vehículos...' });

    try {
      pdfExportService.exportVehiclesToPDF(vehiculos, tiposVehiculo, currentUser);
      setMessage({
        type: 'success',
        text: '✅ PDF de vehículos generado exitosamente'
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      setMessage({
        type: 'error',
        text: '❌ Error al generar el PDF'
      });
    }
  };
  const getMaintenanceAlerts = () => {
    const hoy = new Date();
    return vehiculos.filter(v => {
      if (!v.proximoMantenimiento) return false;
      const proxima = new Date(v.proximoMantenimiento);
      const dias = Math.ceil((proxima - hoy) / (1000 * 60 * 60 * 24));
      return dias <= 7; // Alertas para mantenimientos en 7 días o menos
    }).length;
  };

  const menuItems = useMemo(() => [
    {
      id: 'principal',
      icon: '🏠',
      title: 'Principal',
      submenu: [
        {
          id: 'inicio',
          icon: '🏛️',
          title: 'Inicio',
          tab: 'inicio'
        },
        { id: 'fleet', icon: '🚛', title: 'Panel Flota', view: 'fleet' }
      ]
    },
    {
      id: 'gestion',
      icon: '⚙️',
      title: 'Gestión Sistema',
      submenu: [
        {
          id: 'users',
          icon: '👥',
          title: 'Usuarios',
          tab: 'users',
          badge: getUserStats().total
        },
        {
          id: 'vehicles',
          icon: '🚛',
          title: 'Vehículos',
          tab: 'vehicles',
          badge: getVehicleStats().total
        },
        {
          id: 'maintenance',
          icon: '🔧',
          title: 'Mantenimientos',
          tab: 'maintenance',
          badge: getMaintenanceAlerts(),
          badgeType: getMaintenanceAlerts() > 0 ? 'alert' : null
        },
        {
          id: 'supplies',
          icon: '⛽',
          title: 'Suministros',
          tab: 'supplies'
        },

        {
          id: 'solicitudes',
          icon: '📋',
          title: 'Solicitudes',
          tab: 'solicitudes',
          badge: solicitudes.filter(s => s.estado === 'pendiente').length,
          badgeType: 'alert'
        }
      ]
    }
  ], [getUserStats().total, getVehicleStats().total, solicitudes, vehiculos]); // Agregar vehiculos a las dependencias

  // ========== RENDER PRINCIPAL ==========
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f3f4f6' }}>
      {/* Modal de Tipos de Vehículos - FUERA del componente principal */}
      <TiposVehiculoModal
        showTipoModal={showTipoModal}
        setShowTipoModal={setShowTipoModal}
        editingTipo={editingTipo}
        setEditingTipo={setEditingTipo}
        tipoFormData={tipoFormData}
        setTipoFormData={setTipoFormData}
        handleSaveTipoVehiculo={handleSaveTipoVehiculo}
        handleEditTipo={handleEditTipo}
        handleDeleteTipoVehiculo={handleDeleteTipoVehiculo}
        tiposVehiculo={tiposVehiculo}
        vehiculos={vehiculos}
        loading={loading}
        isMobile={isMobile}
      />

      {/* Overlay para móvil */}
      {isMobile && isSidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 998
          }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR MEJORADO MOBILE-FIRST */}
      <div style={{
        width: isMobile ? '280px' : (isSidebarOpen ? '260px' : '60px'),
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: isMobile ? 'fixed' : 'relative',
        height: '100vh',
        zIndex: 999,
        left: isMobile ? (isSidebarOpen ? '0' : '-280px') : '0',
        boxShadow: isMobile ? '4px 0 20px rgba(0,0,0,0.3)' : '2px 0 10px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'visible', // CAMBIAR de 'hidden' a 'visible' para permitir que el dropdown se muestre
        overflow: 'visible' // Para permitir que el dropdown sobresalga
      }}>
        {/* Header del Sidebar - Mobile First */}
        <div style={{
          padding: isMobile ? '16px' : (isSidebarOpen ? '20px' : '20px 10px'),
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: isMobile ? '60px' : '70px',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '12px' : '10px',
            flex: 1
          }}>
            {(isSidebarOpen || !isMobile) ? (
              <>
                <span style={{
                  fontSize: isMobile ? '28px' : '24px',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}>
                  🔐
                </span>
                {isSidebarOpen && (
                  <div>
                    <h2 style={{
                      margin: 0,
                      color: 'white',
                      fontSize: isMobile ? '18px' : '16px',
                      fontWeight: '600',
                      letterSpacing: '0.5px'
                    }}>
                      Super Admin
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: isMobile ? '13px' : '12px'
                    }}>
                      Panel de Control
                    </p>
                  </div>
                )}
              </>
            ) : (
              <span style={{
                fontSize: '24px',
                margin: '0 auto',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
              }}>
                🔐
              </span>
            )}
          </div>

          {/* Botón de toggle - Diferente para móvil y desktop */}
          {isMobile ? (
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                padding: '10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                minWidth: '40px',
                height: '40px',
                fontSize: '20px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ✕
            </button>
          ) : (
            isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  minWidth: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
              >
                ◀
              </button>
            )
          )}
        </div>

        {/* Botón de expandir cuando está colapsado - Solo Desktop */}
        {!isMobile && !isSidebarOpen && (
          <div style={{ padding: '10px 5px' }}>
            <button
              onClick={() => setIsSidebarOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              title="Expandir menú"
            >
              ▶
            </button>
          </div>
        )}

        {/* SECCIÓN DE NOTIFICACIONES - Mejorada para móvil */}
        <div style={{
          padding: isMobile ? '12px' : (isSidebarOpen ? '10px' : '10px 5px'),
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          position: 'relative', // IMPORTANTE: Agregar position relative
          zIndex: 1000 // Asegurar que el contenedor tenga un z-index apropiado
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: isMobile ? '10px' : '8px',
            padding: isMobile ? '12px' : (isSidebarOpen ? '10px' : '8px'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarOpen ? 'flex-start' : 'center',
            gap: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: isMobile ? '48px' : '40px',
            position: 'relative', // IMPORTANTE: Agregar position relative
            overflow: 'visible' // Importante: permitir que el dropdown se muestre fuera
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              if (!isMobile) { // Solo aplicar transform en desktop
                e.currentTarget.style.transform = 'translateX(2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              if (!isMobile) { // Solo aplicar transform en desktop
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <div style={{
              position: 'relative',
              zIndex: 1 // Asegurar que el contenedor esté por debajo del dropdown
            }}></div>
            <NotificationSystem
              currentUser={currentUser}
              isMobile={isMobile}
              inSidebar={true}
              isCollapsed={!isSidebarOpen}
              onNotificationCountChange={setNotificationCount}
              sidebarZIndex={999} // Pasar el z-index del sidebar al componente
            />
            {isSidebarOpen && (
              <div style={{ color: 'white', pointerEvents: 'none' }}>
                {notificationCount > 0 && (
                  <div style={{
                    fontSize: isMobile ? '12px' : '11px',
                    color: 'rgba(255,255,255,0.7)'
                  }}>
                    {notificationCount} sin leer
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Menú del Sidebar - Mejorado para móvil */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isMobile ? '12px 0' : '10px 0',
          WebkitOverflowScrolling: 'touch'
        }}>
          {menuItems.map(menu => (
            <div key={menu.id} style={{ marginBottom: isMobile ? '8px' : '5px' }}>
              <button
                onClick={() => toggleMenu(menu.id)}
                style={{
                  width: '100%',
                  padding: isMobile ? '14px 20px' : (isSidebarOpen ? '12px 20px' : '12px'),
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: isMobile ? '15px' : '14px',
                  minHeight: isMobile ? '50px' : '44px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'translateX(2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
                title={!isSidebarOpen ? menu.title : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: isMobile ? '20px' : '18px' }}>{menu.icon}</span>
                  {isSidebarOpen && (
                    <span style={{ fontWeight: '500' }}>{menu.title}</span>
                  )}
                </div>
                {isSidebarOpen && menu.submenu && (
                  <span style={{
                    fontSize: isMobile ? '14px' : '12px',
                    transition: 'transform 0.2s',
                    transform: expandedMenus.includes(menu.id) ? 'rotate(90deg)' : 'rotate(0)'
                  }}>
                    ▶
                  </span>
                )}
              </button>

              {/* Submenú con animación */}
              {isSidebarOpen && expandedMenus.includes(menu.id) && menu.submenu && (
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  marginTop: '2px'
                }}>
                  {menu.submenu.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.view) {
                          onViewChange(item.view);
                        } else if (item.tab) {
                          setActiveTab(item.tab);
                        }
                        if (isMobile) setIsSidebarOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: isMobile ? '12px 20px 12px 50px' : '10px 20px 10px 50px',
                        background: (item.tab && activeTab === item.tab) ||
                          (item.view && currentView === item.view)
                          ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                        border: 'none',
                        borderLeft: (item.tab && activeTab === item.tab) ||
                          (item.view && currentView === item.view)
                          ? '4px solid #3b82f6' : '4px solid transparent',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: isMobile ? '14px' : '13px',
                        textAlign: 'left',
                        minHeight: isMobile ? '44px' : '38px'
                      }}
                      onMouseEnter={(e) => {
                        if (!((item.tab && activeTab === item.tab) ||
                          (item.view && currentView === item.view))) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!((item.tab && activeTab === item.tab) ||
                          (item.view && currentView === item.view))) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: isMobile ? '16px' : '14px' }}>{item.icon}</span>
                        <span>{item.title}</span>
                      </div>
                      {item.badge > 0 && (
                        <span style={{
                          background: item.badgeType === 'alert' ? '#ef4444' : '#3b82f6',
                          color: 'white',
                          padding: isMobile ? '3px 8px' : '2px 6px',
                          borderRadius: '12px',
                          fontSize: isMobile ? '12px' : '11px',
                          fontWeight: 'bold',
                          minWidth: '24px',
                          textAlign: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer del Sidebar - Mejorado para móvil */}
        <div style={{
          padding: isMobile ? '16px' : (isSidebarOpen ? '20px' : '10px'),
          borderTop: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          {isSidebarOpen ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '12px' : '10px',
                marginBottom: '15px',
                color: 'white'
              }}>
                <div style={{
                  width: isMobile ? '44px' : '40px',
                  height: isMobile ? '44px' : '40px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '20px' : '18px',
                  flexShrink: 0
                }}>
                  👤
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isMobile ? '15px' : '14px',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {currentUser.name || 'Super Admin'}
                  </div>
                  <div style={{
                    fontSize: isMobile ? '13px' : '12px',
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
                onClick={() => {
                  onLogout();
                  if (isMobile) setIsSidebarOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px' : '10px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: isMobile ? '8px' : '6px',
                  cursor: 'pointer',
                  fontSize: isMobile ? '15px' : '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  minHeight: isMobile ? '44px' : '40px'
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
            </>
          ) : (
            <button
              onClick={onLogout}
              style={{
                width: '40px',
                height: '40px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '18px',
                margin: '0 auto',
                display: 'block',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Cerrar Sesión"
            >
              🚪
            </button>
          )}
        </div>
      </div>

      {/* Contenido Principal */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* Header móvil */}
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
              onClick={() => setIsSidebarOpen(true)}
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
              Panel de Control
            </h1>
          </div>
        )}

        <div style={{ padding: isMobile ? '15px' : '30px' }}>
          {/* MOSTRAR WELCOME SCREEN O CONTENIDO NORMAL */}
          {false && showWelcomeScreen ? (
            <WelcomeScreen
              currentUser={currentUser}
              onClose={() => setShowWelcomeScreen(false)}
              stats={{
                totalUsers: users.length,
                totalVehicles: vehiculos.length,
                pendingSolicitudes: solicitudes.filter(s => s.estado === 'pendiente').length
              }}
            />
          ) : (
            <>
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

              {/* Mensaje para crear zona desde solicitud */}
              {solicitudParaZona && (
                <div style={{
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: '#dbeafe',
                  border: '2px solid #3b82f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <strong style={{ color: '#1e40af' }}>
                      ✅ Solicitud aprobada: {solicitudParaZona.asunto}
                    </strong>
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#1e3a8a' }}>
                      Ahora puedes crear una zona de trabajo basada en esta solicitud
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={crearZonaDesdeSolicitud}
                      style={{
                        padding: '10px 20px',
                        background: '#22c55e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      🗺️ Crear Zona
                    </button>
                    <button
                      onClick={() => setSolicitudParaZona(null)}
                      style={{
                        padding: '10px 20px',
                        background: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {/* CONTENIDO DE INICIO */}
              {activeTab === 'inicio' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'calc(100vh - 200px)',
                  padding: '40px 20px'
                }}>
                  <div style={{
                    textAlign: 'center',
                    animation: 'fadeIn 0.5s ease-in'
                  }}>
                    <style>
                      {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
                    </style>

                    {/* Logo de la Municipalidad */}
                    <img
                      src="/logoQuillon.jpg" // REEMPLAZA CON TU LOGO
                      alt="Municipalidad de Quillón"
                      style={{
                        width: '300px',
                        height: 'auto',
                        objectFit: 'contain',
                        marginBottom: '30px',
                        filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.1))'
                      }}
                      onError={(e) => {
                        // Si no encuentra el logo, muestra un placeholder
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML += `
            <div style="
              width: 300px;
              height: 300px;
              margin: 0 auto 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 20px 40px rgba(102, 126, 234, 0.2);
            ">
              <span style="font-size: 120px; color: white;">🏛️</span>
            </div>
          `;
                      }}
                    />

                  </div>
                </div>
              )}
              {/* CONTENIDO DE USUARIOS */}
              {activeTab === 'users' && (
                <>
                  <h1 style={{
                    margin: '0 0 30px 0',
                    color: '#1e293b',
                    fontSize: '28px',
                    fontWeight: '600'
                  }}>
                    👥 Gestión de Usuarios
                  </h1>

                  {/* Estadísticas de usuarios */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '150px' : '200px'}, 1fr))`,
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
                        {getUserStats().total}
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
                        {getUserStats().admins}
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
                        {getUserStats().trabajadores}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '14px' }}>Trabajadores</div>
                    </div>

                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      borderLeft: '4px solid #6b7280'
                    }}>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937' }}>
                        {getUserStats().monitores}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '14px' }}>Monitores</div>
                    </div>
                  </div>

                  {/* SECCIÓN DE BOTONES CON EXPORTACIÓN PDF */}
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    marginBottom: '20px'
                  }}>
                    {/* Botón crear usuario */}
                    <button
                      onClick={() => {
                        setShowCreateForm(!showCreateForm);
                        setShowEditUserForm(false);
                        setEditingUser(null);
                        setFormData({
                          rut: '',
                          email: '',
                          password: '',
                          name: '',
                          role: 'trabajador',
                          phone: '',
                          vehicleId: '',
                          localidad: '',
                          recoveryPin: '',
                          licenciaConducir: '',
                          fechaVencimientoLicencia: '' // AGREGAR ESTOS DOS CAMPOS
                        });
                      }}
                      style={{
                        padding: '12px 24px',
                        background: showCreateForm
                          ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      {showCreateForm ? '✖ Cancelar' : '➕ Crear Nuevo Usuario'}
                    </button>

                    {/* NUEVO BOTÓN DE EXPORTACIÓN A PDF */}
                    <button
                      onClick={handleExportUsersPDF}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      📄 Exportar a PDF
                    </button>

                    {/* OPCIONAL: Botón de exportación a Excel */}
                    <button
                      onClick={() => {
                        // Aquí puedes agregar exportación a Excel en el futuro
                        setMessage({
                          type: 'info',
                          text: '📊 Función de exportación a Excel próximamente disponible'
                        });
                      }}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      📊 Exportar a Excel
                    </button>

                    {/* Contador de registros */}
                    <div style={{
                      padding: '12px 24px',
                      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginLeft: 'auto'
                    }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        Total: <strong style={{ color: '#1f2937' }}>{users.length}</strong> usuarios
                      </span>
                    </div>
                  </div>

                  {/* Formulario de creación de usuario */}
                  {showCreateForm && !showEditUserForm && (
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
                          gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                          gap: '20px'
                        }}>
                          {/* RUT */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              RUT *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.rut}
                              onChange={(e) => {
                                const rutFormateado = formatearRUT(e.target.value);
                                setFormData({ ...formData, rut: rutFormateado });
                              }}
                              onBlur={(e) => {
                                if (formData.rut && !validarRUT(formData.rut)) {
                                  setMessage({ type: 'error', text: 'RUT inválido. Verifique el dígito verificador.' });
                                } else {
                                  setMessage({ type: '', text: '' });
                                }
                              }}
                              placeholder="12.345.678-9"
                              maxLength="12"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>

                          {/* Nombre Completo */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
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
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>

                          {/* Correo Electrónico */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
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
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>

                          {/* PIN de Recuperación */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              PIN de Recuperación (4 dígitos) *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength="4"
                              pattern="[0-9]{4}"
                              value={formData.recoveryPin}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, recoveryPin: value });
                              }}
                              placeholder="Ej: 1234"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                            <small style={{ color: '#6b7280', fontSize: '11px' }}>
                              Este PIN se usará para recuperar la contraseña
                            </small>
                          </div>

                          {/* SECCIÓN DE LICENCIAS MÚLTIPLES */}
                          <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Licencias de Conducir
                              <span style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                (Puede seleccionar múltiples)
                              </span>
                            </label>

                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '10px',
                              padding: '10px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              background: '#f9fafb'
                            }}>
                              {['B', 'C', 'A1', 'A2', 'A3', 'A4', 'A5', 'D', 'E', 'F'].map(licencia => (
                                <label key={licencia} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  background: formData.licenciasConducir?.includes(licencia) ? '#3b82f6' : 'white',
                                  color: formData.licenciasConducir?.includes(licencia) ? 'white' : '#374151',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  border: '1px solid #d1d5db',
                                  transition: 'all 0.2s'
                                }}>
                                  <input
                                    type="checkbox"
                                    value={licencia}
                                    checked={formData.licenciasConducir?.includes(licencia) || false}
                                    onChange={(e) => {
                                      const newLicencias = e.target.checked
                                        ? [...(formData.licenciasConducir || []), licencia]
                                        : formData.licenciasConducir.filter(l => l !== licencia);
                                      setFormData({ ...formData, licenciasConducir: newLicencias });
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <span style={{ fontWeight: '500' }}>
                                    Clase {licencia}
                                  </span>
                                </label>
                              ))}
                            </div>
                            <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '5px' }}>
                              B: Particulares | C: Motos | A1-A5: Profesionales | D: Maquinaria | E: Tracción animal | F: Discapacidad
                            </small>
                          </div>

                          {/* FECHA DE VENCIMIENTO DE LICENCIA */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Fecha Vencimiento Licencia
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: '#6b7280'
                                }}>
                                  (Se enviará alerta 2 semanas antes)
                                </span>
                              </label>
                              <input
                                type="date"
                                value={formData.fechaVencimientoLicencia}
                                onChange={(e) => {
                                  setFormData({ ...formData, fechaVencimientoLicencia: e.target.value });

                                  // Verificar si está próxima a vencer
                                  const fechaVencimiento = new Date(e.target.value);
                                  const hoy = new Date();
                                  const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                                  if (diasRestantes <= 14 && diasRestantes >= 0) {
                                    setMessage({
                                      type: 'warning',
                                      text: `⚠️ La licencia vence en ${diasRestantes} días`
                                    });
                                  } else if (diasRestantes < 0) {
                                    setMessage({
                                      type: 'error',
                                      text: '❌ La licencia está vencida'
                                    });
                                  }
                                }}
                                min={new Date().toISOString().split('T')[0]}
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

                          {/* OBSERVACIONES DE LICENCIA - NUEVO */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Observaciones/Restricciones de Licencia
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: '#6b7280'
                                }}>
                                  (Lentes, audífonos, restricciones médicas, etc.)
                                </span>
                              </label>
                              <textarea
                                value={formData.observacionesLicencia}
                                onChange={(e) => setFormData({ ...formData, observacionesLicencia: e.target.value })}
                                placeholder="Ej: Debe usar lentes, Restricción horaria nocturna, Solo vehículos automáticos, etc."
                                rows={3}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  resize: 'none',
                                  overflow: 'auto',
                                  minHeight: '80px',
                                  maxHeight: '200px'
                                }}
                              />
                              <div style={{
                                marginTop: '10px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}>
                                {/* Botones rápidos para restricciones comunes */}
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>Agregar rápido:</span>
                                {['Usa lentes 👓', 'Usa audífonos 🦻', 'Solo automático 🚗', 'Sin nocturno 🌙'].map(restriccion => (
                                  <button
                                    key={restriccion}
                                    type="button"
                                    onClick={() => {
                                      const currentObs = formData.observacionesLicencia || '';
                                      const newObs = currentObs ? `${currentObs}, ${restriccion}` : restriccion;
                                      setFormData({ ...formData, observacionesLicencia: newObs });
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#f3f4f6',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {restriccion}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* FOTO DE PERFIL - NUEVO */}
                          <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              📸 Foto de Perfil
                            </label>

                            {formData.fotoPerfil?.url ? (
                              <div style={{
                                display: 'flex',
                                gap: '15px',
                                alignItems: 'center',
                                padding: '15px',
                                background: '#f9fafb',
                                borderRadius: '8px'
                              }}>
                                <img
                                  src={formData.fotoPerfil.url}
                                  alt="Foto de perfil"
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#374151' }}>
                                    Foto cargada exitosamente
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                      ...prev,
                                      fotoPerfil: { url: '', publicId: '', fecha: '' }
                                    }))}
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
                                </div>
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="file"
                                  id="fotoPerfil"
                                  accept=".jpg,.jpeg,.png"
                                  onChange={(e) => handleUserFileUpload(e.target.files[0], 'fotoPerfil', editingUser?.id)}
                                  style={{ display: 'none' }}
                                />
                                <label
                                  htmlFor="fotoPerfil"
                                  style={{
                                    display: 'block',
                                    padding: '30px',
                                    background: '#f9fafb',
                                    border: '2px dashed #d1d5db',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>👤</div>
                                  <div style={{ color: '#374151' }}>Click para subir foto</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                    JPG o PNG - Máx. 10MB
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>

                          {/* ESTADO DE BLOQUEO - NUEVO */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                              <div style={{
                                padding: '15px',
                                background: formData.licenciaBloqueada ? '#fee2e2' : '#f9fafb',
                                borderRadius: '8px',
                                border: formData.licenciaBloqueada ? '2px solid #ef4444' : '1px solid #e5e7eb'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: formData.licenciaBloqueada ? '10px' : '0'
                                }}>
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: formData.licenciaBloqueada ? '#991b1b' : '#374151'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={formData.licenciaBloqueada}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          licenciaBloqueada: e.target.checked,
                                          fechaBloqueo: e.target.checked ? new Date().toISOString() : ''
                                        });
                                      }}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer'
                                      }}
                                    />
                                    {formData.licenciaBloqueada ? '🚫 LICENCIA BLOQUEADA' : '✅ Licencia Habilitada'}
                                  </label>
                                  {formData.licenciaBloqueada && (
                                    <span style={{
                                      fontSize: '12px',
                                      color: '#991b1b',
                                      fontWeight: '600'
                                    }}>
                                      ⚠️ NO PUEDE CONDUCIR
                                    </span>
                                  )}
                                </div>

                                {formData.licenciaBloqueada && (
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      marginBottom: '6px',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      color: '#991b1b'
                                    }}>
                                      Motivo del bloqueo *
                                    </label>
                                    <select
                                      value={formData.motivoBloqueo}
                                      onChange={(e) => setFormData({ ...formData, motivoBloqueo: e.target.value })}
                                      required={formData.licenciaBloqueada}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ef4444',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        marginBottom: '10px'
                                      }}
                                    >
                                      <option value="">-- Seleccionar motivo --</option>
                                      <option value="parte_pendiente">Parte/Multa pendiente</option>
                                      <option value="suspension_judicial">Suspensión judicial</option>
                                      <option value="vencida">Licencia vencida</option>
                                      <option value="examen_medico">Pendiente examen médico</option>
                                      <option value="incapacidad_temporal">Incapacidad temporal</option>
                                      <option value="investigacion">Bajo investigación</option>
                                      <option value="otro">Otro motivo</option>
                                    </select>

                                    {formData.motivoBloqueo === 'otro' && (
                                      <textarea
                                        placeholder="Especifique el motivo del bloqueo..."
                                        required
                                        rows={2}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          border: '1px solid #ef4444',
                                          borderRadius: '4px',
                                          fontSize: '13px'
                                        }}
                                      />
                                    )}

                                    <div style={{
                                      marginTop: '10px',
                                      padding: '10px',
                                      background: '#fef2f2',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      color: '#7f1d1d'
                                    }}>
                                      <strong>⚠️ Importante:</strong> Al bloquear la licencia, el usuario no podrá ser asignado a ningún vehículo hasta que se desbloquee.
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Contraseña */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
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
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

                          {/* Rol */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Rol *
                            </label>
                            <select
                              required
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
                              <option value="monitor">📊 Monitor</option>
                            </select>
                          </div>

                          {/* Teléfono */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Teléfono
                            </label>
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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

                          {/* Localidad (solo para Junta de Vecinos) */}
                          {formData.role === 'junta_vecinos' && (
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Localidad/Sector *
                              </label>
                              <input
                                type="text"
                                required={formData.role === 'junta_vecinos'}
                                value={formData.localidad || ''}
                                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                                placeholder="Ej: Sector Norte, Villa Los Aromos"
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
                          disabled={loading || (formData.licenciaBloqueada && !formData.motivoBloqueo)}
                          style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            background: loading || (formData.licenciaBloqueada && !formData.motivoBloqueo) ? '#9ca3af' : '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: loading || (formData.licenciaBloqueada && !formData.motivoBloqueo) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {loading ? 'Creando...' : '✅ Crear Usuario'}
                        </button>
                      </form>
                    </div>
                  )}


                  {/* Formulario de edición de usuario ACTUALIZADO */}
                  {showEditUserForm && editingUser && (
                    <div style={{
                      background: 'white',
                      padding: '30px',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      marginBottom: '30px'
                    }}>
                      <h2 style={{ margin: '0 0 20px 0', color: '#1f2937', fontSize: '20px' }}>
                        ✏️ Editar Usuario
                      </h2>

                      <form onSubmit={handleUpdateUser}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                          gap: '20px'
                        }}>
                          {/* RUT */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              RUT *
                            </label>
                            <input
                              type="text"
                              required
                              value={formData.rut}
                              onChange={(e) => {
                                const rutFormateado = formatearRUT(e.target.value);
                                setFormData({ ...formData, rut: rutFormateado });
                              }}
                              onBlur={(e) => {
                                if (formData.rut && !validarRUT(formData.rut)) {
                                  setMessage({ type: 'error', text: 'RUT inválido. Verifique el dígito verificador.' });
                                } else {
                                  setMessage({ type: '', text: '' });
                                }
                              }}
                              placeholder="12.345.678-9"
                              maxLength="12"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>

                          {/* Nombre Completo */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
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
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                          </div>

                          {/* Correo Electrónico */}
                          <div>
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
                              value={formData.email}
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
                            <small style={{ color: '#6b7280', fontSize: '12px' }}>
                              El email no se puede modificar
                            </small>
                          </div>

                          {/* PIN de Recuperación */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Nuevo PIN de Recuperación (Opcional)
                            </label>
                            <input
                              type="text"
                              maxLength="4"
                              pattern="[0-9]{4}"
                              value={formData.recoveryPin}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setFormData({ ...formData, recoveryPin: value });
                              }}
                              placeholder="Dejar vacío para mantener el actual"
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                              }}
                            />
                            <small style={{ color: '#6b7280', fontSize: '11px' }}>
                              Solo ingrese si desea cambiar el PIN actual
                            </small>
                          </div>

                          {/* SECCIÓN DE LICENCIAS MÚLTIPLES - AGREGADO */}
                          <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Licencias de Conducir
                              <span style={{
                                marginLeft: '8px',
                                fontSize: '12px',
                                color: '#6b7280'
                              }}>
                                (Puede seleccionar múltiples)
                              </span>
                            </label>

                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '10px',
                              padding: '10px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              background: '#f9fafb'
                            }}>
                              {['B', 'C', 'A1', 'A2', 'A3', 'A4', 'A5', 'D', 'E', 'F'].map(licencia => (
                                <label key={licencia} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '5px 10px',
                                  background: formData.licenciasConducir?.includes(licencia) ? '#3b82f6' : 'white',
                                  color: formData.licenciasConducir?.includes(licencia) ? 'white' : '#374151',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  border: '1px solid #d1d5db',
                                  transition: 'all 0.2s'
                                }}>
                                  <input
                                    type="checkbox"
                                    value={licencia}
                                    checked={formData.licenciasConducir?.includes(licencia) || false}
                                    onChange={(e) => {
                                      const newLicencias = e.target.checked
                                        ? [...(formData.licenciasConducir || []), licencia]
                                        : formData.licenciasConducir.filter(l => l !== licencia);
                                      setFormData({ ...formData, licenciasConducir: newLicencias });
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <span style={{ fontWeight: '500' }}>
                                    Clase {licencia}
                                  </span>
                                </label>
                              ))}
                            </div>
                            <small style={{ color: '#6b7280', fontSize: '11px', display: 'block', marginTop: '5px' }}>
                              B: Particulares | C: Motos | A1-A5: Profesionales | D: Maquinaria | E: Tracción animal | F: Discapacidad
                            </small>
                          </div>

                          {/* FECHA DE VENCIMIENTO DE LICENCIA - AGREGADO */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Fecha Vencimiento Licencia
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: '#6b7280'
                                }}>
                                  (Se enviará alerta 2 semanas antes)
                                </span>
                              </label>
                              <input
                                type="date"
                                value={formData.fechaVencimientoLicencia}
                                onChange={(e) => {
                                  setFormData({ ...formData, fechaVencimientoLicencia: e.target.value });

                                  // Verificar si está próxima a vencer
                                  const fechaVencimiento = new Date(e.target.value);
                                  const hoy = new Date();
                                  const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                                  if (diasRestantes <= 14 && diasRestantes >= 0) {
                                    setMessage({
                                      type: 'warning',
                                      text: `⚠️ La licencia vence en ${diasRestantes} días`
                                    });
                                  } else if (diasRestantes < 0) {
                                    setMessage({
                                      type: 'error',
                                      text: '❌ La licencia está vencida'
                                    });
                                  }
                                }}
                                min={new Date().toISOString().split('T')[0]}
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

                          {/* OBSERVACIONES DE LICENCIA - AGREGADO */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Observaciones/Restricciones de Licencia
                                <span style={{
                                  marginLeft: '8px',
                                  fontSize: '12px',
                                  color: '#6b7280'
                                }}>
                                  (Lentes, audífonos, restricciones médicas, etc.)
                                </span>
                              </label>
                              <textarea
                                value={formData.observacionesLicencia}
                                onChange={(e) => setFormData({ ...formData, observacionesLicencia: e.target.value })}
                                placeholder="Ej: Debe usar lentes, Restricción horaria nocturna, Solo vehículos automáticos, etc."
                                rows={3}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  resize: 'none'
                                }}
                              />
                              <div style={{
                                marginTop: '10px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}>
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>Agregar rápido:</span>
                                {['Usa lentes 👓', 'Usa audífonos 🦻', 'Solo automático 🚗', 'Sin nocturno 🌙'].map(restriccion => (
                                  <button
                                    key={restriccion}
                                    type="button"
                                    onClick={() => {
                                      const currentObs = formData.observacionesLicencia || '';
                                      const newObs = currentObs ? `${currentObs}, ${restriccion}` : restriccion;
                                      setFormData({ ...formData, observacionesLicencia: newObs });
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: '#f3f4f6',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {restriccion}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* 🆕 NUEVO CAMPO - FOTO DE PERFIL */}
                          <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              📸 Foto de Perfil
                            </label>

                            {formData.fotoPerfil?.url ? (
                              <div style={{
                                display: 'flex',
                                gap: '15px',
                                alignItems: 'center',
                                padding: '15px',
                                background: '#f9fafb',
                                borderRadius: '8px'
                              }}>
                                <img
                                  src={formData.fotoPerfil.url}
                                  alt="Foto de perfil"
                                  style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    objectFit: 'cover'
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#374151' }}>
                                    Foto actual
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                      ...prev,
                                      fotoPerfil: { url: '', publicId: '', fecha: '' }
                                    }))}
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
                                </div>
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="file"
                                  id="fotoPerfilEdit"
                                  accept=".jpg,.jpeg,.png"
                                  onChange={(e) => handleUserFileUpload(e.target.files[0], 'fotoPerfil', editingUser?.id)}
                                  style={{ display: 'none' }}
                                />
                                <label
                                  htmlFor="fotoPerfilEdit"
                                  style={{
                                    display: 'block',
                                    padding: '30px',
                                    background: '#f9fafb',
                                    border: '2px dashed #d1d5db',
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>👤</div>
                                  <div style={{ color: '#374151' }}>Click para subir foto</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>
                                    JPG o PNG - Máx. 10MB
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                          {/* 🆕 FIN FOTO DE PERFIL */}

                          {/* ESTADO DE BLOQUEO - AGREGADO */}
                          {formData.licenciasConducir && formData.licenciasConducir.length > 0 && (
                            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                              <div style={{
                                padding: '15px',
                                background: formData.licenciaBloqueada ? '#fee2e2' : '#f9fafb',
                                borderRadius: '8px',
                                border: formData.licenciaBloqueada ? '2px solid #ef4444' : '1px solid #e5e7eb'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: formData.licenciaBloqueada ? '10px' : '0'
                                }}>
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: formData.licenciaBloqueada ? '#991b1b' : '#374151'
                                  }}>
                                    <input
                                      type="checkbox"
                                      checked={formData.licenciaBloqueada}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          licenciaBloqueada: e.target.checked,
                                          fechaBloqueo: e.target.checked ? new Date().toISOString() : ''
                                        });
                                      }}
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer'
                                      }}
                                    />
                                    {formData.licenciaBloqueada ? '🚫 LICENCIA BLOQUEADA' : '✅ Licencia Habilitada'}
                                  </label>
                                  {formData.licenciaBloqueada && (
                                    <span style={{
                                      fontSize: '12px',
                                      color: '#991b1b',
                                      fontWeight: '600'
                                    }}>
                                      ⚠️ NO PUEDE CONDUCIR
                                    </span>
                                  )}
                                </div>

                                {formData.licenciaBloqueada && (
                                  <div>
                                    <label style={{
                                      display: 'block',
                                      marginBottom: '6px',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      color: '#991b1b'
                                    }}>
                                      Motivo del bloqueo *
                                    </label>
                                    <select
                                      value={formData.motivoBloqueo}
                                      onChange={(e) => setFormData({ ...formData, motivoBloqueo: e.target.value })}
                                      required={formData.licenciaBloqueada}
                                      style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #ef4444',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        marginBottom: '10px'
                                      }}
                                    >
                                      <option value="">-- Seleccionar motivo --</option>
                                      <option value="parte_pendiente">Parte/Multa pendiente</option>
                                      <option value="suspension_judicial">Suspensión judicial</option>
                                      <option value="vencida">Licencia vencida</option>
                                      <option value="examen_medico">Pendiente examen médico</option>
                                      <option value="incapacidad_temporal">Incapacidad temporal</option>
                                      <option value="investigacion">Bajo investigación</option>
                                      <option value="otro">Otro motivo</option>
                                    </select>

                                    {formData.motivoBloqueo === 'otro' && (
                                      <textarea
                                        placeholder="Especifique el motivo del bloqueo..."
                                        required
                                        rows={2}
                                        style={{
                                          width: '100%',
                                          padding: '8px',
                                          border: '1px solid #ef4444',
                                          borderRadius: '4px',
                                          fontSize: '13px'
                                        }}
                                      />
                                    )}

                                    <div style={{
                                      marginTop: '10px',
                                      padding: '10px',
                                      background: '#fef2f2',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      color: '#7f1d1d'
                                    }}>
                                      <strong>⚠️ Importante:</strong> Al bloquear la licencia, el usuario no podrá ser asignado a ningún vehículo hasta que se desbloquee.
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Rol */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Rol *
                            </label>
                            <select
                              required
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
                              <option value="monitor">📊 Monitor</option>
                            </select>
                          </div>

                          {/* Teléfono */}
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '8px',
                              color: '#374151',
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              Teléfono
                            </label>
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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

                          {/* Localidad (solo para Junta de Vecinos) - AGREGADO */}
                          {formData.role === 'junta_vecinos' && (
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Localidad/Sector
                              </label>
                              <input
                                type="text"
                                value={formData.localidad || ''}
                                onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                                placeholder="Ej: Sector Norte, Villa Los Aromos"
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

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                          <button
                            type="submit"
                            disabled={loading || (formData.licenciaBloqueada && !formData.motivoBloqueo)}
                            style={{
                              padding: '12px 24px',
                              background: loading || (formData.licenciaBloqueada && !formData.motivoBloqueo) ? '#9ca3af' : '#22c55e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '16px',
                              fontWeight: '500',
                              cursor: loading || (formData.licenciaBloqueada && !formData.motivoBloqueo) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {loading ? 'Actualizando...' : '✅ Guardar Cambios'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowEditUserForm(false);
                              setEditingUser(null);
                              setFormData({
                                email: '',
                                password: '',
                                name: '',
                                role: 'trabajador',
                                phone: '',
                                vehicleId: '',
                                localidad: '',
                                recoveryPin: '',
                                rut: '',
                                licenciaConducir: '',
                                licenciasConducir: [],
                                fechaVencimientoLicencia: '',
                                observacionesLicencia: '',
                                licenciaBloqueada: false,
                                motivoBloqueo: '',
                                fechaBloqueo: ''
                              });
                            }}
                            style={{
                              padding: '12px 24px',
                              background: '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '16px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
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
                      borderBottom: '1px solid #e5e7eb',
                      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
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
                            {users.some(u => u.role === 'junta_vecinos') && (
                              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                                Localidad
                              </th>
                            )}
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                              Teléfono
                            </th>
                            <th style={{ padding: '12px 20px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => {
                            // Calcular estado de licencia DENTRO del map para cada usuario
                            let estadoLicencia = null;
                            if (user.fechaVencimientoLicencia && (user.licenciaConducir || (user.licenciasConducir && user.licenciasConducir.length > 0))) {
                              const fechaVencimiento = new Date(user.fechaVencimientoLicencia);
                              const hoy = new Date();
                              const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                              if (diasRestantes < 0) {
                                estadoLicencia = { tipo: 'vencida', texto: 'VENCIDA', color: '#ef4444' };
                              } else if (diasRestantes <= 14) {
                                estadoLicencia = { tipo: 'porVencer', texto: `${diasRestantes} días`, color: '#f59e0b' };
                              } else {
                                estadoLicencia = { tipo: 'vigente', texto: 'Vigente', color: '#22c55e' };
                              }
                            }

                            return (
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
                                      user.role === 'admin' ? '#dbeafe' :
                                        user.role === 'monitor' ? '#f3f4f6' :  // AGREGAR ESTA LÍNEA
                                          user.role === 'junta_vecinos' ? '#fef3c7' : '#dcfce7',
                                    color: user.role === 'superadmin' ? '#6b21a8' :
                                      user.role === 'admin' ? '#1e40af' :
                                        user.role === 'monitor' ? '#374151' :  // AGREGAR ESTA LÍNEA
                                          user.role === 'junta_vecinos' ? '#92400e' : '#15803d'
                                  }}>
                                    {user.role === 'superadmin' ? '🔐 Super Admin' :
                                      user.role === 'admin' ? '👨‍💼 Admin' :
                                        user.role === 'monitor' ? '📊 Monitor' :  // AGREGAR ESTA LÍNEA
                                          user.role === 'junta_vecinos' ? '🏘️ Junta Vecinos' : '👷 Trabajador'}
                                  </span>
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  {/* Columna de Licencia con todos los indicadores */}
                                  {(user.licenciaConducir || (user.licenciasConducir && user.licenciasConducir.length > 0)) ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: '500' }}>
                                        {user.licenciasConducir ? user.licenciasConducir.join(', ') : `Clase ${user.licenciaConducir}`}
                                      </span>

                                      {/* Indicador de licencia bloqueada */}
                                      {user.licenciaBloqueada && (
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          background: '#ef4444',
                                          color: 'white'
                                        }}>
                                          🚫 BLOQUEADA
                                        </span>
                                      )}

                                      {/* Indicador de lentes */}
                                      {user.observacionesLicencia && user.observacionesLicencia.includes('lentes') && (
                                        <span title={user.observacionesLicencia}>👓</span>
                                      )}

                                      {/* Estado de vencimiento */}
                                      {estadoLicencia && !user.licenciaBloqueada && (
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          background: estadoLicencia.color + '20',
                                          color: estadoLicencia.color,
                                          border: `1px solid ${estadoLicencia.color}`
                                        }}>
                                          {estadoLicencia.tipo === 'vencida' && '⚠️'} {estadoLicencia.texto}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#9ca3af', fontSize: '12px' }}>Sin licencia</span>
                                  )}
                                </td>
                                <td style={{ padding: '16px 20px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {user.fotoPerfil?.url ? (
                                      <img
                                        src={user.fotoPerfil.url}
                                        alt={user.name}
                                        style={{
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '50%',
                                          objectFit: 'cover'
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: '#e5e7eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '14px'
                                      }}>
                                        👤
                                      </div>
                                    )}
                                    <span>{user.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280' }}>
                                  {user.phone || '-'}
                                </td>
                                <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                  {user.id !== currentUser.uid ? (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                      <button
                                        onClick={() => handleEditUser(user)}
                                        style={{
                                          padding: '6px 12px',
                                          background: '#3b82f6',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✏️ Editar
                                      </button>
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
                                      <button
                                        onClick={() => handleExportSingleUserPDF(user)}
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
                                        📕 Exportar
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{
                                      padding: '6px 12px',
                                      background: '#e5e7eb',
                                      color: '#6b7280',
                                      borderRadius: '4px',
                                      fontSize: '12px'
                                    }}>
                                      Usuario actual
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {users.length === 0 && (
                        <div style={{
                          padding: '40px',
                          textAlign: 'center',
                          color: '#6b7280'
                        }}>
                          <div style={{ fontSize: '48px', marginBottom: '10px' }}>👥</div>
                          <p style={{ fontSize: '16px' }}>No hay usuarios registrados</p>
                          <p style={{ fontSize: '14px' }}>Haz clic en "Crear Nuevo Usuario" para comenzar</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* CONTENIDO DE VEHÍCULOS */}
              {activeTab === 'vehicles' && (
                <>
                  <h1 style={{
                    margin: '0 0 30px 0',
                    color: '#1e293b',
                    fontSize: '28px',
                    fontWeight: '600'
                  }}>
                    🚛 Gestión de Vehículos y Maquinaria
                  </h1>

                  {/* Estadísticas de vehículos */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '150px' : '200px'}, 1fr))`,
                    gap: '15px',
                    marginBottom: '30px'
                  }}>
                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      borderLeft: '4px solid #3b82f6'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                        {getVehicleStats().total}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>📊 Total</div>
                    </div>

                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      borderLeft: '4px solid #22c55e'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                        {getVehicleStats().disponibles}
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
                        {getVehicleStats().enUso}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>🔧 En Uso</div>
                    </div>

                    <div style={{
                      background: 'white',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      borderLeft: '4px solid #ef4444'
                    }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                        {getVehicleStats().mantenimiento}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '13px' }}>🔧 Mantenimiento</div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <button
                      onClick={() => {
                        setShowVehicleForm(!showVehicleForm);
                        if (showVehicleForm) {
                          setEditingVehicle(null);
                          setVehicleFormData({
                            nombre: '',
                            tipo: '',
                            marca: '',
                            modelo: '',
                            año: new Date().getFullYear(),
                            patente: '',
                            color: '',
                            numeroChasis: '',
                            numeroMotor: '',
                            kilometraje: 0,
                            capacidadCombustible: 0,
                            tipoCombustible: 'gasolina',
                            ultimoMantenimiento: '',
                            proximoMantenimiento: '',
                            kilometrajeUltimoMantenimiento: 0,
                            kilometrajeProximoMantenimiento: 0,
                            fechaRevisionTecnica: '',
                            fechaSeguro: '',
                            fechaPermisoCirculacion: '',
                            operadorAsignado: '',
                            estado: 'disponible',
                            lat: null,
                            lng: null,
                            observaciones: ''
                          });
                        }
                      }}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      {showVehicleForm ? '✖ Cancelar' : '➕ Registrar Nuevo Vehículo'}
                    </button>

                    <button
                      onClick={() => setShowTipoModal(true)}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      ⚙️ Gestionar Tipos de Vehículos
                    </button>
                    <button
                      onClick={handleExportVehiclesPDF}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #dd8b2cff 0%, #ee1f10ff 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      📕 Exportar a PDF
                    </button>
                  </div>

                  {/* Formulario de vehículo */}
                  {/* Formulario de vehículo AMPLIADO */}
                  {showVehicleForm && (
                    <div style={{
                      background: 'white',
                      padding: '30px',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      marginBottom: '30px'
                    }}>
                      <h2 style={{ margin: '0 0 20px 0', color: '#1f2937', fontSize: '20px' }}>
                        {editingVehicle ? '✏️ Editar Vehículo' : '🚛 Registrar Nuevo Vehículo'}
                      </h2>

                      <form onSubmit={handleCreateOrUpdateVehicle}>
                        {/* SECCIÓN 1: DATOS GENERALES */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            📋 Datos Generales
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Nombre/Identificación *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleFormData.nombre}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, nombre: e.target.value })}
                                placeholder="Ej: Camión 01, Retroexcavadora 02"
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
                                Tipo de Vehículo *
                              </label>
                              <select
                                required
                                value={vehicleFormData.tipo}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, tipo: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="">-- Seleccionar tipo --</option>
                                {tiposVehiculo.map(tipo => (
                                  <option key={tipo.id} value={tipo.id}>
                                    {tipo.icon} {tipo.nombre}
                                  </option>
                                ))}
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
                                Marca *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleFormData.marca}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, marca: e.target.value })}
                                placeholder="Ej: Toyota, Caterpillar"
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
                                Modelo *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleFormData.modelo}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, modelo: e.target.value })}
                                placeholder="Ej: Hilux, 320D"
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
                                Año
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.año}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, año: parseInt(e.target.value) })}
                                min="1990"
                                max={new Date().getFullYear() + 1}
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
                                Patente *
                              </label>
                              <input
                                type="text"
                                required
                                value={vehicleFormData.patente}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, patente: e.target.value })}
                                placeholder="Ej: XX-XX-99"
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
                                N° VIN/Chasis
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.vin}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vin: e.target.value })}
                                placeholder="Número de chasis"
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
                                N° Motor
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.numeroMotor}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, numeroMotor: e.target.value })}
                                placeholder="Número de motor"
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
                                Color
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.color}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, color: e.target.value })}
                                placeholder="Ej: Blanco"
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
                                Modalidad de Adquisición
                              </label>
                              <select
                                value={vehicleFormData.modalidadAdquisicion}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, modalidadAdquisicion: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="compra">Compra</option>
                                <option value="leasing">Leasing</option>
                                <option value="arriendo">Arriendo</option>
                                <option value="donacion">Donación</option>
                                <option value="comodato">Comodato</option>
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
                                Proveedor
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.proveedor}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, proveedor: e.target.value })}
                                placeholder="Nombre del proveedor"
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
                                Valor de Adquisición (CLP)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.valorAdquisicion}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, valorAdquisicion: parseInt(e.target.value) })}
                                placeholder="0"
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        {/* SECCIÓN DE LICENCIAS REQUERIDAS - NUEVO */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{
                            margin: '0 0 15px 0',
                            color: '#374151',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            🚗 Licencias Requeridas para Operar
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              fontWeight: '400'
                            }}>
                              (El operador debe tener al menos una de estas licencias)
                            </span>
                          </h3>

                          <div style={{
                            padding: '15px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '10px',
                              marginBottom: '10px'
                            }}>
                              {['B', 'C', 'A1', 'A2', 'A3', 'A4', 'A5', 'D', 'E', 'F'].map(licencia => (
                                <label key={licencia} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '8px 15px',
                                  background: vehicleFormData.licenciasRequeridas?.includes(licencia) ? '#3b82f6' : 'white',
                                  color: vehicleFormData.licenciasRequeridas?.includes(licencia) ? 'white' : '#374151',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  border: '2px solid',
                                  borderColor: vehicleFormData.licenciasRequeridas?.includes(licencia) ? '#3b82f6' : '#d1d5db',
                                  transition: 'all 0.2s',
                                  fontWeight: '500'
                                }}>
                                  <input
                                    type="checkbox"
                                    value={licencia}
                                    checked={vehicleFormData.licenciasRequeridas?.includes(licencia) || false}
                                    onChange={(e) => {
                                      const newLicencias = e.target.checked
                                        ? [...(vehicleFormData.licenciasRequeridas || []), licencia]
                                        : vehicleFormData.licenciasRequeridas.filter(l => l !== licencia);
                                      setVehicleFormData({ ...vehicleFormData, licenciasRequeridas: newLicencias });
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                  <span>Clase {licencia}</span>
                                </label>
                              ))}
                            </div>

                            <div style={{
                              padding: '10px',
                              background: '#fef3c7',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: '#92400e'
                            }}>
                              <strong>⚠️ Importante:</strong> Solo los trabajadores con al menos una de las licencias seleccionadas podrán ser asignados a este vehículo.
                            </div>

                            {/* Referencia de tipos de licencia */}
                            <div style={{
                              marginTop: '10px',
                              padding: '10px',
                              background: 'white',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              <div style={{ fontWeight: '600', marginBottom: '5px' }}>📖 Referencia de Clases:</div>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '5px' }}>
                                <div>• <strong>B:</strong> Vehículos particulares</div>
                                <div>• <strong>C:</strong> Motocicletas</div>
                                <div>• <strong>A1:</strong> Taxis</div>
                                <div>• <strong>A2:</strong> Buses pequeños</div>
                                <div>• <strong>A3:</strong> Taxis y ambulancias</div>
                                <div>• <strong>A4:</strong> Transporte de carga</div>
                                <div>• <strong>A5:</strong> Todo tipo de vehículos</div>
                                <div>• <strong>D:</strong> Maquinaria automotriz</div>
                                <div>• <strong>E:</strong> Tracción animal</div>
                                <div>• <strong>F:</strong> Vehículos adaptados</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* SECCIÓN 2: ESPECIFICACIONES TÉCNICAS */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            ⚙️ Especificaciones Técnicas
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                🛢️ Tipo de Aceite de Motor
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.tipoAceite}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, tipoAceite: e.target.value })}
                                placeholder="Ej: 15W-40, 5W-30, SAE 40"
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
                                Tipo de Combustible
                              </label>
                              <select
                                value={vehicleFormData.tipoCombustible}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, tipoCombustible: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="gasolina">Gasolina</option>
                                <option value="diesel">Diesel</option>
                                <option value="electrico">Eléctrico</option>
                                <option value="hibrido">Híbrido</option>
                                <option value="gas">Gas</option>
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
                                Cilindrada (cc)
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.cilindrada}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, cilindrada: e.target.value })}
                                placeholder="Ej: 2400"
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
                                Potencia (HP)
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.potencia}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, potencia: e.target.value })}
                                placeholder="Ej: 150"
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
                                Transmisión
                              </label>
                              <select
                                value={vehicleFormData.transmision}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, transmision: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="manual">Manual</option>
                                <option value="automatica">Automática</option>
                                <option value="secuencial">Secuencial</option>
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
                                Tracción
                              </label>
                              <select
                                value={vehicleFormData.traccion}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, traccion: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="4x2">4x2</option>
                                <option value="4x4">4x4</option>
                                <option value="6x4">6x4</option>
                                <option value="6x6">6x6</option>
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
                                Capacidad de Pasajeros
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.capacidadPasajeros}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, capacidadPasajeros: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Capacidad de Carga (kg)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.capacidadCarga}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, capacidadCarga: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Equipamiento Adicional
                              </label>
                              <textarea
                                value={vehicleFormData.equipamientoAdicional}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, equipamientoAdicional: e.target.value })}
                                placeholder="Ej: Barra de luces, winche, etc."
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        {/* SECCIÓN 3: DOCUMENTACIÓN LEGAL */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            📄 Documentación Legal
                          </h3>

                          {/* PARTE 1: CAMPOS DE INFORMACIÓN */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px',
                            marginBottom: '20px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                N° Permiso Circulación
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.numeroPermisoCirculacion}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, numeroPermisoCirculacion: e.target.value })}
                                placeholder="Número de permiso"
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
                                🧯 Fecha Vencimiento Extintor
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.fechaVencimientoExtintor}
                                onChange={(e) => {
                                  setVehicleFormData({ ...vehicleFormData, fechaVencimientoExtintor: e.target.value });

                                  // Verificar si está próximo a vencer
                                  const fechaVencimiento = new Date(e.target.value);
                                  const hoy = new Date();
                                  const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                                  if (diasRestantes <= 30 && diasRestantes >= 0) {
                                    setMessage({
                                      type: 'warning',
                                      text: `⚠️ El extintor vence en ${diasRestantes} días. Programar recarga.`
                                    });
                                  } else if (diasRestantes < 0) {
                                    setMessage({
                                      type: 'error',
                                      text: '🚨 EXTINTOR VENCIDO - Requiere recarga inmediata'
                                    });
                                  }
                                }}
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
                                Vigencia Permiso Circulación
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.vigenciaPermisoCirculacion}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vigenciaPermisoCirculacion: e.target.value })}
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
                                Fecha Revisión Técnica
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.fechaRevisionTecnica}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, fechaRevisionTecnica: e.target.value })}
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
                                Vigencia SOAP
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.vigenciaSOAP}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vigenciaSOAP: e.target.value })}
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
                                ¿Tiene Seguro Complementario?
                              </label>
                              <select
                                value={vehicleFormData.seguroComplementario}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, seguroComplementario: e.target.value === 'true' })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="false">No</option>
                                <option value="true">Sí</option>
                              </select>
                            </div>
                            {/* SECCIÓN DE SEGURO COMERCIAL/ADICIONAL */}
                            {/* SECCIÓN DE PÓLIZA DE SEGURO DEL VEHÍCULO */}
                            <div style={{
                              marginTop: '20px',
                              padding: '20px',
                              background: '#f0f9ff',
                              borderRadius: '8px',
                              border: '1px solid #0284c7',
                              gridColumn: isMobile ? 'span 1' : 'span 2'  // <-- AÑADE ESTA LÍNEA

                            }}>
                              <h4 style={{
                                margin: '0 0 15px 0',
                                color: '#0c4a6e',
                                fontSize: '15px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                🛡️ Póliza de Seguro del Vehículo
                                <span style={{
                                  fontSize: '12px',
                                  color: '#64748b',
                                  fontWeight: '400'
                                }}>
                                  (Documentación del seguro obligatorio o adicional)
                                </span>
                              </h4>

                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '200px'}, 1fr))`,
                                gap: '15px',
                                marginBottom: '15px'
                              }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                                    Tipo de Seguro
                                  </label>
                                  <select
                                    value={vehicleFormData.polizaSeguroVehiculo?.tipoSeguro || ''}
                                    onChange={(e) => setVehicleFormData(prev => ({
                                      ...prev,
                                      polizaSeguroVehiculo: { ...prev.polizaSeguroVehiculo, tipoSeguro: e.target.value }
                                    }))}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px'
                                    }}
                                  >
                                    <option value="">-- Seleccionar --</option>
                                    <option value="soap">SOAP (Obligatorio)</option>
                                    <option value="adicional">Seguro Adicional</option>
                                    <option value="ambos">Ambos</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                                    N° Póliza
                                  </label>
                                  <input
                                    type="text"
                                    value={vehicleFormData.polizaSeguroVehiculo?.numeroPoliza || ''}
                                    onChange={(e) => setVehicleFormData(prev => ({
                                      ...prev,
                                      polizaSeguroVehiculo: { ...prev.polizaSeguroVehiculo, numeroPoliza: e.target.value }
                                    }))}
                                    placeholder="Número de póliza"
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                                    Compañía
                                  </label>
                                  <select
                                    value={vehicleFormData.polizaSeguroVehiculo?.compania || ''}
                                    onChange={(e) => setVehicleFormData(prev => ({
                                      ...prev,
                                      polizaSeguroVehiculo: { ...prev.polizaSeguroVehiculo, compania: e.target.value }
                                    }))}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px'
                                    }}
                                  >
                                    <option value="">-- Seleccionar --</option>
                                    <option value="HDI">HDI Seguros</option>
                                    <option value="MAPFRE">MAPFRE</option>
                                    <option value="BCI">BCI Seguros</option>
                                    <option value="Liberty">Liberty Seguros</option>
                                    <option value="SURA">SURA</option>
                                    <option value="Chilena">Chilena Consolidada</option>
                                    <option value="Consorcio">Consorcio</option>
                                    <option value="SOAP">SOAP Genérico</option>
                                    <option value="Otra">Otra</option>
                                  </select>
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                                    Vigencia
                                  </label>
                                  <input
                                    type="date"
                                    value={vehicleFormData.polizaSeguroVehiculo?.vigencia || ''}
                                    onChange={(e) => setVehicleFormData(prev => ({
                                      ...prev,
                                      polizaSeguroVehiculo: { ...prev.polizaSeguroVehiculo, vigencia: e.target.value }
                                    }))}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px'
                                    }}
                                  />
                                </div>

                                <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#374151' }}>
                                    Cobertura
                                  </label>
                                  <textarea
                                    value={vehicleFormData.polizaSeguroVehiculo?.cobertura || ''}
                                    onChange={(e) => setVehicleFormData(prev => ({
                                      ...prev,
                                      polizaSeguroVehiculo: { ...prev.polizaSeguroVehiculo, cobertura: e.target.value }
                                    }))}
                                    placeholder="Detalle de cobertura del seguro"
                                    rows={2}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: '4px',
                                      fontSize: '13px',
                                      resize: 'none'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Subir documento de póliza */}
                              {vehicleFormData.polizaSeguroVehiculo?.url ? (
                                <div style={{
                                  padding: '10px',
                                  background: 'white',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>
                                      📄 {vehicleFormData.polizaSeguroVehiculo.nombre}
                                    </p>
                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                                      Subido: {new Date(vehicleFormData.polizaSeguroVehiculo.fecha).toLocaleDateString('es-CL')}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <a
                                      href={vehicleFormData.polizaSeguroVehiculo.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        padding: '6px 12px',
                                        background: '#3b82f6',
                                        color: 'white',
                                        borderRadius: '4px',
                                        textDecoration: 'none',
                                        fontSize: '12px'
                                      }}
                                    >
                                      👁️ Ver
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => setVehicleFormData(prev => ({
                                        ...prev,
                                        polizaSeguroVehiculo: {
                                          ...prev.polizaSeguroVehiculo,
                                          url: '',
                                          nombre: '',
                                          publicId: ''
                                        }
                                      }))}
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
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="file"
                                    id="polizaSeguroVehiculo"
                                    accept=".jpg,.jpeg,.png"
                                    onChange={(e) => handleVehiclePolizaUpload(e.target.files[0])}
                                    style={{ display: 'none' }}
                                  />
                                  <label
                                    htmlFor="polizaSeguroVehiculo"
                                    style={{
                                      display: 'block',
                                      padding: '20px',
                                      background: 'white',
                                      border: '2px dashed #d1d5db',
                                      borderRadius: '6px',
                                      textAlign: 'center',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{ fontSize: '20px', marginBottom: '5px' }}>📤</div>
                                    <div style={{ fontSize: '13px' }}>Subir imagen de póliza</div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '5px' }}>
                                      Solo imágenes JPG o PNG - Máx. 10MB
                                    </div>
                                  </label>
                                </div>
                              )}
                            </div>
                            {vehicleFormData.seguroComplementario && (
                              <div style={{
                                marginTop: '20px',
                                padding: '20px',
                                background: '#eff6ff',
                                borderRadius: '8px',
                                border: '1px solid #3b82f6'
                              }}>
                                <h4 style={{
                                  margin: '0 0 15px 0',
                                  color: '#1e40af',
                                  fontSize: '15px',
                                  fontWeight: '600'
                                }}>
                                  🛡️ Información del Seguro Comercial/Adicional
                                </h4>

                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                                  gap: '15px'
                                }}>
                                  <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                                      Compañía Aseguradora
                                    </label>
                                    <select
                                      value={vehicleFormData.companiaSeguroAdicional}
                                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, companiaSeguroAdicional: e.target.value })}
                                      style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px'
                                      }}
                                    >
                                      <option value="">-- Seleccionar --</option>
                                      <option value="HDI Seguros">HDI Seguros</option>
                                      <option value="MAPFRE">MAPFRE</option>
                                      <option value="BCI Seguros">BCI Seguros</option>
                                      <option value="Liberty Seguros">Liberty Seguros</option>
                                      <option value="SURA">SURA</option>
                                      <option value="Chilena Consolidada">Chilena Consolidada</option>
                                      <option value="Consorcio">Consorcio</option>
                                      <option value="Otra">Otra</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                                      N° de Póliza
                                    </label>
                                    <input
                                      type="text"
                                      value={vehicleFormData.numeroPolizaAdicional}
                                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, numeroPolizaAdicional: e.target.value })}
                                      placeholder="Número de póliza"
                                      style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px'
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                                      Vigencia del Seguro
                                    </label>
                                    <input
                                      type="date"
                                      value={vehicleFormData.vigenciaSeguroAdicional}
                                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, vigenciaSeguroAdicional: e.target.value })}
                                      style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px'
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                                      Tipo de Cobertura
                                    </label>
                                    <select
                                      value={vehicleFormData.coberturaSeguroAdicional}
                                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, coberturaSeguroAdicional: e.target.value })}
                                      style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px'
                                      }}
                                    >
                                      <option value="">-- Seleccionar --</option>
                                      <option value="basica">Básica (Daños a terceros)</option>
                                      <option value="completa">Completa (Todo riesgo)</option>
                                      <option value="parcial">Parcial (Robo + Daños a terceros)</option>
                                      <option value="personalizada">Personalizada</option>
                                    </select>
                                  </div>

                                  <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>
                                      Detalles de Cobertura
                                    </label>
                                    <textarea
                                      value={vehicleFormData.seguroAdicional}
                                      onChange={(e) => setVehicleFormData({ ...vehicleFormData, seguroAdicional: e.target.value })}
                                      placeholder="Ej: Incluye responsabilidad civil, robo, daños propios, asistencia en ruta, etc."
                                      rows={3}
                                      style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        resize: 'none'
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                            )}

                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Multas Registradas
                              </label>
                              <textarea
                                value={vehicleFormData.multasRegistradas}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, multasRegistradas: e.target.value })}
                                placeholder="Detalle de multas si existen"
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                          </div>


                          {/* PARTE 2: CARGA DE DOCUMENTOS DIGITALIZADOS */}
                          <div style={{
                            marginTop: '25px',
                            padding: '20px',
                            background: '#f9fafb',
                            borderRadius: '8px'
                          }}>
                            <h4 style={{
                              margin: '0 0 15px 0',
                              fontSize: '15px',
                              fontWeight: '600',
                              color: '#1f2937',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              📁 Documentos Digitalizados
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                fontWeight: '400'
                              }}>
                                ("(Solo imágenes JPG o PNG - Máx. 10MB)" JPG o PNG - Máx. 10MB)
                              </span>
                            </h4>
                            {/* Aviso importante sobre PDFs */}
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
                              gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '280px'}, 1fr))`,
                              gap: '15px'
                            }}>
                              {/* Permiso de Circulación */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.permisoCirculacion?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    📋 Permiso Circulación
                                  </h5>
                                  {vehicleFormData.documentos?.permisoCirculacion?.url && (
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

                                {vehicleFormData.documentos?.permisoCirculacion?.url ? (
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
                                        {vehicleFormData.documentos.permisoCirculacion.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.permisoCirculacion.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.permisoCirculacion.url}
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
                                        onClick={() => handleDeleteDocument('permisoCirculacion')}
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
                                      id="permisoCirculacion"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'permisoCirculacion', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="permisoCirculacion"
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
                                      {uploadProgress.permisoCirculacion ? (
                                        <div>
                                          <div style={{ marginBottom: '5px' }}>
                                            Subiendo... {uploadProgress.permisoCirculacion}%
                                          </div>
                                          <div style={{
                                            width: '100%',
                                            height: '4px',
                                            background: '#e5e7eb',
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                          }}>
                                            <div style={{
                                              width: `${uploadProgress.permisoCirculacion}%`,
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

                              {/* Certificado/Foto del Extintor */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.extintor?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    🧯 Certificado de Extintor
                                  </h5>
                                  {vehicleFormData.documentos?.extintor?.url && (
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

                                {vehicleFormData.documentos?.extintor?.url ? (
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
                                        {vehicleFormData.documentos.extintor.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.extintor.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <a href={vehicleFormData.documentos.extintor.url}
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
                                        onClick={() => handleDeleteDocument('extintor')}
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
                                      id="extintor"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'extintor', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="extintor"
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
                                      {uploadProgress.extintor ? (
                                        <div>
                                          <div style={{ marginBottom: '5px' }}>
                                            Subiendo... {uploadProgress.extintor}%
                                          </div>
                                          <div style={{
                                            width: '100%',
                                            height: '4px',
                                            background: '#e5e7eb',
                                            borderRadius: '2px',
                                            overflow: 'hidden'
                                          }}>
                                            <div style={{
                                              width: `${uploadProgress.extintor}%`,
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
                                          <div style={{ fontSize: '11px', marginTop: '5px', color: '#9ca3af' }}>
                                            Foto del extintor y etiqueta de vencimiento
                                          </div>
                                        </>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </div>

                              {/* Revisión Técnica */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.revisionTecnica?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    🔧 Revisión Técnica
                                  </h5>
                                  {vehicleFormData.documentos?.revisionTecnica?.url && (
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

                                {vehicleFormData.documentos?.revisionTecnica?.url ? (
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
                                        {vehicleFormData.documentos.revisionTecnica.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.revisionTecnica.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.revisionTecnica.url}
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
                                        onClick={() => handleDeleteDocument('revisionTecnica')}
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
                                      id="revisionTecnica"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'revisionTecnica', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="revisionTecnica"
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

                              {/* Certificado de Gases */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.certificadoGases?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    💨 Certificado de Gases
                                  </h5>
                                  {vehicleFormData.documentos?.certificadoGases?.url && (
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

                                {vehicleFormData.documentos?.certificadoGases?.url ? (
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
                                        {vehicleFormData.documentos.certificadoGases.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.certificadoGases.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.certificadoGases.url}
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
                                        onClick={() => handleDeleteDocument('certificadoGases')}
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
                                      id="certificadoGases"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'certificadoGases', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="certificadoGases"
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

                              {/* SOAP */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.soap?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    🛡️ SOAP
                                  </h5>
                                  {vehicleFormData.documentos?.soap?.url && (
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

                                {vehicleFormData.documentos?.soap?.url ? (
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
                                        {vehicleFormData.documentos.soap.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.soap.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.soap.url}
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
                                        onClick={() => handleDeleteDocument('soap')}
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
                                      id="soap"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'soap', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="soap"
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

                              {/* Seguro Complementario */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.seguroComplementario?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    📑 Seguro Complementario
                                  </h5>
                                  {vehicleFormData.documentos?.seguroComplementario?.url && (
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

                                {vehicleFormData.documentos?.seguroComplementario?.url ? (
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
                                        {vehicleFormData.documentos.seguroComplementario.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.seguroComplementario.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.seguroComplementario.url}
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
                                        onClick={() => handleDeleteDocument('seguroComplementario')}
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
                                      id="seguroComplementario"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'seguroComplementario', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="seguroComplementario"
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

                              {/* Padrón Municipal */}
                              <div style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                padding: '15px',
                                background: vehicleFormData.documentos?.padronMunicipal?.url ? '#f0fdf4' : 'white'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: '10px'
                                }}>
                                  <h5 style={{
                                    margin: 0,
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#374151'
                                  }}>
                                    🏛️ Padrón Municipal
                                  </h5>
                                  {vehicleFormData.documentos?.padronMunicipal?.url && (
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

                                {vehicleFormData.documentos?.padronMunicipal?.url ? (
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
                                        {vehicleFormData.documentos.padronMunicipal.nombre}
                                      </div>
                                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                                        {new Date(vehicleFormData.documentos.padronMunicipal.fecha).toLocaleDateString('es-CL')}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>

                                      <a href={vehicleFormData.documentos.padronMunicipal.url}
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
                                        onClick={() => handleDeleteDocument('padronMunicipal')}
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
                                      id="padronMunicipal"
                                      accept=".jpg,.jpeg,.png"
                                      onChange={(e) => handleFileUpload(e.target.files[0], 'padronMunicipal', editingVehicle?.id)}
                                      style={{ display: 'none' }}
                                    />
                                    <label
                                      htmlFor="padronMunicipal"
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

                            {/* Sección de documentos adicionales */}
                            <div style={{
                              marginTop: '20px',
                              padding: '15px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb'
                            }}>
                              <h5 style={{
                                margin: '0 0 12px 0',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151'
                              }}>
                                📂 Otros Documentos
                              </h5>

                              {/* Lista de documentos adicionales */}
                              {vehicleFormData.documentos?.otros?.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                  {vehicleFormData.documentos.otros.map((doc, index) => (
                                    <div key={index} style={{
                                      padding: '10px',
                                      background: '#f9fafb',
                                      borderRadius: '6px',
                                      marginBottom: '8px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
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
                                          📄 {doc.nombre}
                                        </div>
                                        <div style={{
                                          color: '#6b7280',
                                          fontSize: '11px',
                                          marginTop: '2px'
                                        }}>
                                          {formatFileSize(doc.tamaño)} • {new Date(doc.fecha).toLocaleDateString('es-CL')}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', marginLeft: '10px' }}>

                                        <a href={doc.url}
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
                                          onClick={() => handleDeleteDocument('otros', index)}
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

                              {/* Botón para agregar más documentos */}
                              <div>
                                <input
                                  type="file"
                                  id="otrosDocumentos"
                                  accept=".jpg,.jpeg,.png"
                                  onChange={(e) => handleFileUpload(e.target.files[0], 'otros', editingVehicle?.id)}
                                  style={{ display: 'none' }}
                                  disabled={uploadingFile}
                                />
                                <label
                                  htmlFor="otrosDocumentos"
                                  style={{
                                    display: 'inline-block',
                                    padding: '8px 16px',
                                    background: uploadingFile ? '#9ca3af' : '#10b981',
                                    color: 'white',
                                    borderRadius: '6px',
                                    cursor: uploadingFile ? 'not-allowed' : 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '500'
                                  }}
                                >
                                  {uploadingFile ? '⏳ Subiendo...' : '➕ Agregar Documento'}
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* SECCIÓN 4: CONTROL DE OPERACIÓN */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            📊 Control de Operación
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Kilometraje Actual
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.kilometraje}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, kilometraje: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Horas de Uso (Maquinaria)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.horasUso}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, horasUso: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Consumo Promedio (L/100km)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.consumoPromedio}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, consumoPromedio: parseFloat(e.target.value) })}
                                placeholder="0"
                                step="0.1"
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
                                ¿Tiene GPS/Telemetría?
                              </label>
                              <select
                                value={vehicleFormData.tieneGPS}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, tieneGPS: e.target.value === 'true' })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="false">No</option>
                                <option value="true">Sí</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* SECCIÓN 5: MANTENIMIENTO */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            🔧 Mantenimiento y Estado
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Estado Actual *
                              </label>
                              <select
                                required
                                value={vehicleFormData.estado}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, estado: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="disponible">✅ Disponible</option>
                                <option value="en_uso">🔧 En Uso</option>
                                <option value="mantenimiento">🔧 En Mantenimiento</option>
                                <option value="fuera_servicio">❌ Fuera de Servicio</option>
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
                                Última Mantención
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.ultimoMantenimiento}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, ultimoMantenimiento: e.target.value })}
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
                                Próxima Mantención
                              </label>
                              <input
                                type="date"
                                value={vehicleFormData.proximoMantenimiento}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, proximoMantenimiento: e.target.value })}
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
                                Taller de Mantención
                              </label>
                              <input
                                type="text"
                                value={vehicleFormData.tallerMantenimiento}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, tallerMantenimiento: e.target.value })}
                                placeholder="Nombre del taller"
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* SECCIÓN 6: COSTOS Y CICLO DE VIDA */}
                        <div style={{
                          marginBottom: '25px',
                          paddingBottom: '20px',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <h3 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                            💰 Costos y Ciclo de Vida
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '100%' : '250px'}, 1fr))`,
                            gap: '15px'
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                marginBottom: '6px',
                                color: '#374151',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                Costo Combustible Mensual (CLP)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.costoCombustibleMensual}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, costoCombustibleMensual: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Costo Seguro Anual (CLP)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.costoSeguroAnual}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, costoSeguroAnual: parseInt(e.target.value) })}
                                placeholder="0"
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
                                Vida Útil Estimada (años)
                              </label>
                              <input
                                type="number"
                                value={vehicleFormData.vidaUtilEstimada}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vidaUtilEstimada: parseInt(e.target.value) })}
                                placeholder="10"
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
                                Estado Patrimonial
                              </label>
                              <select
                                value={vehicleFormData.estadoPatrimonial}
                                onChange={(e) => setVehicleFormData({ ...vehicleFormData, estadoPatrimonial: e.target.value })}
                                style={{
                                  width: '100%',
                                  padding: '10px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px'
                                }}
                              >
                                <option value="activo">Activo</option>
                                <option value="baja">Baja</option>
                                <option value="en_proceso_baja">En Proceso de Baja</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* OBSERVACIONES GENERALES */}
                        <div style={{ marginBottom: '25px' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            color: '#374151',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            📝 Observaciones Generales
                          </label>
                          <textarea
                            value={vehicleFormData.observaciones}
                            onChange={(e) => setVehicleFormData({ ...vehicleFormData, observaciones: e.target.value })}
                            placeholder="Notas adicionales sobre el vehículo..."
                            rows={4}
                            style={{
                              width: '100%',
                              padding: '10px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px'
                            }}
                          />
                        </div>

                        {/* BOTONES DE ACCIÓN */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="submit"
                            disabled={loading}
                            style={{
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
                            {loading ? 'Guardando...' : editingVehicle ? '✅ Actualizar Vehículo' : '✅ Registrar Vehículo'}
                          </button>

                          {editingVehicle && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingVehicle(null);
                                setShowVehicleForm(false);
                                // Resetear formulario con todos los campos nuevos
                                setVehicleFormData({
                                  // ... todos los campos iniciales
                                });
                              }}
                              style={{
                                padding: '12px 24px',
                                background: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer'
                              }}
                            >
                              Cancelar Edición
                            </button>
                          )}
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Lista de vehículos */}
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
                        🚛 Lista de Vehículos y Maquinaria
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
                              Tipo
                            </th>
                            <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                              Marca/Modelo
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
                          {vehiculos.map((vehiculo) => (
                            <tr key={vehiculo.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                                {vehiculo.nombre}
                              </td>
                              <td style={{ padding: '16px 20px' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  background: '#e0f2fe',
                                  color: '#075985'
                                }}>
                                  {(() => {
                                    const tipo = tiposVehiculo.find(t => t.id === vehiculo.tipo);
                                    return tipo ? `${tipo.icon} ${tipo.nombre}` : vehiculo.tipo;
                                  })()}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280' }}>
                                {vehiculo.marca} {vehiculo.modelo}
                              </td>
                              <td style={{ padding: '16px 20px' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  background: vehiculo.estado === 'disponible' ? '#dcfce7' :
                                    vehiculo.estado === 'en_uso' ? '#dbeafe' :
                                      vehiculo.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                                  color: vehiculo.estado === 'disponible' ? '#15803d' :
                                    vehiculo.estado === 'en_uso' ? '#1e40af' :
                                      vehiculo.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                                }}>
                                  {vehiculo.estado === 'disponible' ? '✅ Disponible' :
                                    vehiculo.estado === 'en_uso' ? '🔧 En Uso' :
                                      vehiculo.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera Servicio'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleEditVehicle(vehiculo)}
                                    style={{
                                      padding: '6px 12px',
                                      background: '#3b82f6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVehicle(vehiculo.id)}
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
                                    🗑️
                                  </button>


                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {vehiculos.length === 0 && (
                        <div style={{
                          padding: '40px',
                          textAlign: 'center',
                          color: '#6b7280'
                        }}>
                          No hay vehículos registrados. Haz clic en "Registrar Nuevo Vehículo" para comenzar.
                        </div>
                      )}
                    </div>
                  </div>
                </>

              )}
              {/* MANTENIMIENTOS - Módulo original */}
              {activeTab === 'maintenance' && (
                <VehicleMaintenanceModule
                  vehiculos={vehiculos}
                  currentUser={currentUser}
                  isMobile={isMobile}
                />
              )}

              {/* SUMINISTROS - Módulo mejorado con pasos */}
              {activeTab === 'supplies' && (
                <PreventiveMaintenanceModule
                  vehiculos={vehiculos}
                  currentUser={currentUser}
                  isMobile={isMobile}
                />
              )}

              {/* CONTENIDO DE SOLICITUDES */}
              {activeTab === 'solicitudes' && (
                <>
                  <h1 style={{
                    margin: '0 0 30px 0',
                    color: '#1e293b',
                    fontSize: '28px',
                    fontWeight: '600'
                  }}>
                    📋 Gestión de Solicitudes
                  </h1>

                  {/* Puedes agregar aquí el contenido de solicitudes del código original */}
                  <div style={{
                    background: 'white',
                    padding: '40px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    Contenido de solicitudes aquí...
                  </div>
                </>
              )}
              {/* CONTENIDO DE MANTENIMIENTO */}

            </>
          )}
        </div>
      </div >
    </div >
  );
};

export default SuperAdmin;