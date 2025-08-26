// src/components/VehicleMaintenanceModule.js

import React, { useState, useEffect, useCallback } from 'react';
import { pdfExportService } from '../services/pdfExportService';
import {
    database,
    storage,
    auth
} from '../config/firebase';
import {
    ref as databaseRef,
    push,
    update,
    onValue,
    off,
    set as databaseSet
} from 'firebase/database';
import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import { cloudinaryConfig } from '../config/cloudinary';

const VehicleMaintenanceModule = ({
    vehiculos,
    currentUser,
    isMobile
}) => {
    // Estados principales
    const [searchPatente, setSearchPatente] = useState('');
    const [searchFechaDesde, setSearchFechaDesde] = useState('');
    const [searchFechaHasta, setSearchFechaHasta] = useState('');
    const [filteredHistory, setFilteredHistory] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [maintenanceHistory, setMaintenanceHistory] = useState([]);
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Estado del formulario de mantenimiento
    const [maintenanceForm, setMaintenanceForm] = useState({
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().slice(0, 5),
        tipoMantenimiento: 'preventivo',
        kilometraje: '',
        horasUso: '',

        // Checklist de inspección
        gata: 'no_aplica',
        gataObservaciones: '',

        chalecoReflectante: 'no_aplica',
        chalecoObservaciones: '',

        llaveRepuesto: 'no_aplica',
        llaveObservaciones: '',

        cinturon: 'no_aplica',
        cinturonObservaciones: '',

        parabrisas: 'bueno',
        parabrisasObservaciones: '',

        lucesFreno: 'bueno',
        lucesObservaciones: '',

        lucesDelanteras: 'bueno',
        lucesDObservaciones: '',

        // Mantenimiento realizado
        cambioAceite: false,
        filtroAire: false,
        filtroAceite: false,
        filtroCombustible: false,
        revisionFrenos: false,
        revisionNeumaticos: false,
        revisionSuspension: false,
        revisionDireccion: false,
        revisionBateria: false,
        revisionLuces: false,
        nivelLiquidos: false,

        // Observaciones generales
        observacionesGenerales: '',
        proximoMantenimientoKm: '',
        proximoMantenimientoFecha: '',

        // Información del responsable
        realizadoPor: currentUser.name || currentUser.email,
        tallerResponsable: '',
        costoMantenimiento: 0,

        // Fotos del mantenimiento
        fotos: []
    });
    useEffect(() => {
        let filtered = [...maintenanceHistory];

        // Filtro por patente
        if (searchPatente) {
            filtered = filtered.filter(m =>
                m.vehiculoNombre?.toLowerCase().includes(searchPatente.toLowerCase()) ||
                selectedVehicle?.patente?.toLowerCase().includes(searchPatente.toLowerCase())
            );
        }

        // Filtro por fecha desde
        if (searchFechaDesde) {
            filtered = filtered.filter(m =>
                new Date(m.fecha) >= new Date(searchFechaDesde)
            );
        }

        // Filtro por fecha hasta
        if (searchFechaHasta) {
            filtered = filtered.filter(m =>
                new Date(m.fecha) <= new Date(searchFechaHasta)
            );
        }

        setFilteredHistory(filtered);
    }, [maintenanceHistory, searchPatente, searchFechaDesde, searchFechaHasta]);


    // Cargar historial de mantenimiento cuando se selecciona un vehículo
    useEffect(() => {
        if (selectedVehicle) {
            loadMaintenanceHistory(selectedVehicle.id);
        }
    }, [selectedVehicle]);

    // Función para cargar historial
    const loadMaintenanceHistory = (vehicleId) => {
        const historyRef = databaseRef(database, `mantenimientos/${vehicleId}`);

        const unsubscribe = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const historyArray = Object.entries(data)
                    .map(([id, maintenance]) => ({
                        id,
                        ...maintenance
                    }))
                    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                setMaintenanceHistory(historyArray);
            } else {
                setMaintenanceHistory([]);
            }
        });

        return () => off(historyRef);
    };

    // Función para subir fotos a Cloudinary
    const handlePhotoUpload = async (files) => {
        if (!files || files.length === 0) return;

        setUploadingPhotos(true);
        const uploadedPhotos = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                // Validar tipo de archivo
                if (!file.type.startsWith('image/')) {
                    setMessage({
                        type: 'error',
                        text: `El archivo ${file.name} no es una imagen válida`
                    });
                    continue;
                }

                // Validar tamaño
                if (file.size > 10 * 1024 * 1024) {
                    setMessage({
                        type: 'error',
                        text: `El archivo ${file.name} excede el límite de 10MB`
                    });
                    continue;
                }

                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', 'vehiculos_docs');

                const vehicleId = selectedVehicle.id;
                const timestamp = Date.now();
                const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');

                formData.append('folder', `municipalidad/mantenimientos/${vehicleId}/${timestamp}`);
                formData.append('public_id', `${timestamp}_${cleanFileName}`);

                setUploadProgress(Math.round(((i + 1) / files.length) * 100));

                const response = await fetch(
                    `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
                    {
                        method: 'POST',
                        body: formData
                    }
                );

                const data = await response.json();

                uploadedPhotos.push({
                    url: data.secure_url,
                    publicId: data.public_id,
                    nombre: file.name,
                    fecha: new Date().toISOString(),
                    tamaño: file.size
                });
            }

            // Actualizar el estado con las fotos subidas
            setMaintenanceForm(prev => ({
                ...prev,
                fotos: [...prev.fotos, ...uploadedPhotos]
            }));

            setMessage({
                type: 'success',
                text: `✅ ${uploadedPhotos.length} foto(s) subidas exitosamente`
            });

        } catch (error) {
            console.error('Error al subir fotos:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al subir las fotos'
            });
        } finally {
            setUploadingPhotos(false);
            setUploadProgress(0);
        }
    };

    // Función para eliminar foto
    const handleDeletePhoto = (index) => {
        setMaintenanceForm(prev => ({
            ...prev,
            fotos: prev.fotos.filter((_, i) => i !== index)
        }));
    };

    // Función para guardar mantenimiento
    const handleSaveMaintenance = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Combinar fecha y hora
            const fechaHoraCompleta = `${maintenanceForm.fecha}T${maintenanceForm.hora}:00`;

            const maintenanceData = {
                ...maintenanceForm,
                fechaCompleta: fechaHoraCompleta, // Agregar fecha y hora combinadas
                vehiculoId: selectedVehicle.id,
                vehiculoNombre: selectedVehicle.nombre,
                vehiculoPatente: selectedVehicle.patente, // AGREGAR PATENTE
                fechaRegistro: new Date().toISOString(),
                registradoPor: currentUser.uid,
                registradoPorNombre: currentUser.name || currentUser.email
            };
            // Guardar en la base de datos
            const maintenanceRef = databaseRef(database, `mantenimientos/${selectedVehicle.id}`);
            const newMaintenanceRef = push(maintenanceRef);
            await databaseSet(newMaintenanceRef, maintenanceData);

            // Actualizar el vehículo con la información del último mantenimiento
            const vehicleRef = databaseRef(database, `vehiculos/${selectedVehicle.id}`);
            await update(vehicleRef, {
                ultimoMantenimiento: maintenanceForm.fecha,
                kilometrajeUltimoMantenimiento: maintenanceForm.kilometraje || selectedVehicle.kilometraje,
                proximoMantenimiento: maintenanceForm.proximoMantenimientoFecha,
                kilometrajeProximoMantenimiento: maintenanceForm.proximoMantenimientoKm,
                ultimaActualizacion: new Date().toISOString()
            });

            setMessage({
                type: 'success',
                text: '✅ Mantenimiento registrado exitosamente'
            });

            // Resetear formulario
            resetForm();
            setShowMaintenanceForm(false);

        } catch (error) {
            console.error('Error al guardar mantenimiento:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al guardar el mantenimiento'
            });
        } finally {
            setLoading(false);
        }
    };

    // Función para resetear el formulario
    const resetForm = () => {
        setMaintenanceForm({
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().slice(0, 5),
            tipoMantenimiento: 'preventivo',
            kilometraje: '',
            horasUso: '',
            gata: 'no_aplica',
            gataObservaciones: '',
            chalecoReflectante: 'no_aplica',
            chalecoObservaciones: '',
            llaveRepuesto: 'no_aplica',
            llaveObservaciones: '',
            cinturon: 'no_aplica',
            cinturonObservaciones: '',
            parabrisas: 'bueno',
            parabrisasObservaciones: '',
            lucesFreno: 'bueno',
            lucesObservaciones: '',
            lucesDelanteras: 'bueno',
            lucesDObservaciones: '',
            cambioAceite: false,
            filtroAire: false,
            filtroAceite: false,
            filtroCombustible: false,
            revisionFrenos: false,
            revisionNeumaticos: false,
            revisionSuspension: false,
            revisionDireccion: false,
            revisionBateria: false,
            revisionLuces: false,
            nivelLiquidos: false,
            observacionesGenerales: '',
            proximoMantenimientoKm: '',
            proximoMantenimientoFecha: '',
            realizadoPor: currentUser.name || currentUser.email,
            tallerResponsable: '',
            costoMantenimiento: 0,
            fotos: []
        });
    };

    // Función para exportar historial a PDF
    // Luego modifica la función handleExportPDF:
    const handleExportPDF = () => {
        if (!selectedVehicle) {
            setMessage({
                type: 'error',
                text: 'No hay vehículo seleccionado'
            });
            return;
        }

        if (maintenanceHistory.length === 0) {
            setMessage({
                type: 'warning',
                text: 'No hay historial de mantenimiento para exportar'
            });
            return;
        }

        try {
            pdfExportService.exportMaintenanceHistory(
                selectedVehicle,
                maintenanceHistory,
                currentUser
            );

            setMessage({
                type: 'success',
                text: 'PDF generado exitosamente'
            });
        } catch (error) {
            console.error('Error al generar PDF:', error);
            setMessage({
                type: 'error',
                text: 'Error al generar el PDF'
            });
        }
    };

    return (
        <div style={{ padding: isMobile ? '15px' : '30px' }}>
            {/* Header */}
            <div style={{
                marginBottom: '30px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <h1 style={{
                    margin: 0,
                    color: '#1e293b',
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '600'
                }}>
                    🔧 Módulo de Mantenimiento Vehicular
                </h1>

                {selectedVehicle && (
                    <button
                        onClick={() => setSelectedVehicle(null)}
                        style={{
                            padding: '10px 20px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        ← Volver a lista
                    </button>
                )}
            </div>

            {/* Mensajes */}
            {message.text && (
                <div style={{
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    background: message.type === 'success' ? '#dcfce7' :
                        message.type === 'error' ? '#fee2e2' : '#dbeafe',
                    border: `1px solid ${message.type === 'success' ? '#86efac' :
                        message.type === 'error' ? '#fecaca' : '#93c5fd'
                        }`,
                    color: message.type === 'success' ? '#166534' :
                        message.type === 'error' ? '#991b1b' : '#1e40af'
                }}>
                    {message.text}
                </div>
            )}

            {!selectedVehicle ? (
                // Lista de vehículos
                <VehicleSelectionGrid
                    vehiculos={vehiculos}
                    onSelectVehicle={setSelectedVehicle}
                    isMobile={isMobile}
                />
            ) : (
                // Vista de mantenimiento del vehículo seleccionado
                <>
                    {/* Información del vehículo */}
                    <VehicleInfoCard
                        vehicle={selectedVehicle}
                        isMobile={isMobile}
                    />

                    {/* Botones de acción */}
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '20px',
                        flexWrap: 'wrap'
                    }}>
                        <button
                            onClick={() => setShowMaintenanceForm(!showMaintenanceForm)}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            {showMaintenanceForm ? '✖ Cancelar' : '➕ Registrar Mantenimiento'}
                        </button>

                        <button
                            onClick={handleExportPDF}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            📄 Exportar Historial PDF
                        </button>
                    </div>

                    {/* Formulario de mantenimiento */}
                    {showMaintenanceForm && (
                        <MaintenanceForm
                            form={maintenanceForm}
                            setForm={setMaintenanceForm}
                            onSubmit={handleSaveMaintenance}
                            onPhotoUpload={handlePhotoUpload}
                            onDeletePhoto={handleDeletePhoto}
                            uploadingPhotos={uploadingPhotos}
                            uploadProgress={uploadProgress}
                            loading={loading}
                            isMobile={isMobile}
                            vehicle={selectedVehicle}
                            currentUser={currentUser}  // AGREGAR ESTA LÍNEA

                        />
                    )}

                    {/* Filtros de búsqueda - AGREGAR ANTES DEL HISTORIAL */}
                    {maintenanceHistory.length > 0 && (
                        <div style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '20px',
                            marginBottom: '20px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                            <h3 style={{
                                margin: '0 0 15px 0',
                                fontSize: '18px',
                                color: '#1f2937'
                            }}>
                                🔍 Filtros de Búsqueda
                            </h3>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                                gap: '15px'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        color: '#6b7280'
                                    }}>
                                        Buscar por Patente
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: XX-XX-99"
                                        value={searchPatente}
                                        onChange={(e) => setSearchPatente(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
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
                                        fontSize: '13px',
                                        color: '#6b7280'
                                    }}>
                                        Fecha Desde
                                    </label>
                                    <input
                                        type="date"
                                        value={searchFechaDesde}
                                        onChange={(e) => setSearchFechaDesde(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
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
                                        fontSize: '13px',
                                        color: '#6b7280'
                                    }}>
                                        Fecha Hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={searchFechaHasta}
                                        onChange={(e) => setSearchFechaHasta(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => {
                                            setSearchPatente('');
                                            setSearchFechaDesde('');
                                            setSearchFechaHasta('');
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            background: '#6b7280',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Limpiar Filtros
                                    </button>
                                </div>
                            </div>

                            {/* Mostrar resultados */}
                            <div style={{
                                marginTop: '15px',
                                padding: '10px',
                                background: '#f9fafb',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#6b7280'
                            }}>
                                Mostrando {filteredHistory.length} de {maintenanceHistory.length} registros
                            </div>
                        </div>
                    )}

                    {/* Historial de mantenimientos */}
                    <MaintenanceHistory
                        history={filteredHistory}
                        isMobile={isMobile}
                    />
                </>
            )}
        </div>
    );
};

// Componente para selección de vehículo
// Componente para selección de vehículo - MODIFICADO
const VehicleSelectionGrid = ({ vehiculos, onSelectVehicle, isMobile }) => {
    // Agregar estado para el filtro
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('todos');

    const getMaintenanceStatus = (vehicle) => {
        if (!vehicle.proximoMantenimiento) return 'sin_programar';

        const hoy = new Date();
        const proximaFecha = new Date(vehicle.proximoMantenimiento);
        const diasRestantes = Math.ceil((proximaFecha - hoy) / (1000 * 60 * 60 * 24));

        if (diasRestantes < 0) return 'vencido';
        if (diasRestantes <= 7) return 'urgente';
        if (diasRestantes <= 30) return 'proximo';
        return 'ok';
    };

    // Filtrar vehículos
    const filteredVehiculos = vehiculos.filter(vehicle => {
        // Filtro por búsqueda
        const matchesSearch = 
            vehicle.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.patente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.modelo?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filtro por estado de mantenimiento
        const status = getMaintenanceStatus(vehicle);
        const matchesStatus = 
            filterStatus === 'todos' ||
            (filterStatus === 'vencido' && status === 'vencido') ||
            (filterStatus === 'urgente' && status === 'urgente') ||
            (filterStatus === 'proximo' && status === 'proximo') ||
            (filterStatus === 'ok' && status === 'ok');

        return matchesSearch && matchesStatus;
    });

    return (
        <div>
            {/* Barra de filtros */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
                <h3 style={{
                    margin: '0 0 15px 0',
                    fontSize: '18px',
                    color: '#1f2937'
                }}>
                    🔍 Buscar Vehículo
                </h3>
                
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 150px',
                    gap: '15px'
                }}>
                    <input
                        type="text"
                        placeholder="Buscar por nombre, patente, marca o modelo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '10px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                        }}
                    />
                    
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{
                            padding: '10px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px'
                        }}
                    >
                        <option value="todos">Todos los estados</option>
                        <option value="vencido">⚠️ Mantenimiento vencido</option>
                        <option value="urgente">⏰ Mantenimiento urgente</option>
                        <option value="proximo">📅 Mantenimiento próximo</option>
                        <option value="ok">✅ Mantenimiento al día</option>
                    </select>
                    
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFilterStatus('todos');
                        }}
                        style={{
                            padding: '10px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        Limpiar
                    </button>
                </div>
                
                <div style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    color: '#6b7280'
                }}>
                    Mostrando {filteredVehiculos.length} de {vehiculos.length} vehículos
                </div>
            </div>

            {/* Grid de vehículos */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '100%' : '300px'}, 1fr))`,
                gap: '20px'
            }}>
                {filteredVehiculos.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1',
                        padding: '40px',
                        textAlign: 'center',
                        background: 'white',
                        borderRadius: '12px',
                        color: '#6b7280'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
                        <p style={{ fontSize: '16px' }}>No se encontraron vehículos</p>
                        <p style={{ fontSize: '14px' }}>Intenta con otros términos de búsqueda</p>
                    </div>
                ) : (
                    filteredVehiculos.map(vehicle => {
                        const status = getMaintenanceStatus(vehicle);

                        return (
                            <div
                                key={vehicle.id}
                                onClick={() => onSelectVehicle(vehicle)}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s',
                                    border: '2px solid',
                                    borderColor: status === 'vencido' ? '#ef4444' :
                                        status === 'urgente' ? '#f59e0b' :
                                            status === 'proximo' ? '#3b82f6' : '#e5e7eb'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'start',
                                    marginBottom: '12px'
                                }}>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: '18px',
                                        color: '#1f2937'
                                    }}>
                                        🚛 {vehicle.nombre}
                                    </h3>

                                    {status === 'vencido' && (
                                        <span style={{
                                            padding: '4px 8px',
                                            background: '#fee2e2',
                                            color: '#991b1b',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            ⚠️ VENCIDO
                                        </span>
                                    )}
                                    {status === 'urgente' && (
                                        <span style={{
                                            padding: '4px 8px',
                                            background: '#fef3c7',
                                            color: '#92400e',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            ⏰ URGENTE
                                        </span>
                                    )}
                                    {status === 'proximo' && (
                                        <span style={{
                                            padding: '4px 8px',
                                            background: '#dbeafe',
                                            color: '#1e40af',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            📅 PRÓXIMO
                                        </span>
                                    )}
                                </div>

                                <div style={{
                                    fontSize: '14px',
                                    color: '#6b7280',
                                    lineHeight: '1.6'
                                }}>
                                    <div>📍 {vehicle.marca} {vehicle.modelo}</div>
                                    <div>🔢 Patente: {vehicle.patente}</div>
                                    {vehicle.kilometraje && (
                                        <div>📏 {vehicle.kilometraje.toLocaleString()} km</div>
                                    )}
                                    {vehicle.ultimoMantenimiento && (
                                        <div>
                                            🔧 Último: {new Date(vehicle.ultimoMantenimiento).toLocaleDateString('es-CL')}
                                        </div>
                                    )}
                                    {vehicle.proximoMantenimiento && (
                                        <div style={{
                                            marginTop: '8px',
                                            padding: '8px',
                                            background: '#f9fafb',
                                            borderRadius: '4px',
                                            fontSize: '13px'
                                        }}>
                                            📆 Próximo: {new Date(vehicle.proximoMantenimiento).toLocaleDateString('es-CL')}
                                            {vehicle.kilometrajeProximoMantenimiento && (
                                                <span> o {vehicle.kilometrajeProximoMantenimiento.toLocaleString()} km</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

// Componente de información del vehículo
const VehicleInfoCard = ({ vehicle, isMobile }) => (
    <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
    }}>
        <h2 style={{
            margin: '0 0 15px 0',
            fontSize: '20px',
            color: '#1f2937'
        }}>
            🚛 {vehicle.nombre}
        </h2>

        <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
        }}>
            <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Marca/Modelo</span>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>
                    {vehicle.marca} {vehicle.modelo}
                </div>
            </div>
            <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Patente</span>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>
                    {vehicle.patente}
                </div>
            </div>
            <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Kilometraje Actual</span>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>
                    {vehicle.kilometraje?.toLocaleString() || 0} km
                </div>
            </div>
            <div>
                <span style={{ color: '#6b7280', fontSize: '13px' }}>Estado</span>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: vehicle.estado === 'disponible' ? '#dcfce7' :
                            vehicle.estado === 'en_uso' ? '#dbeafe' :
                                vehicle.estado === 'mantenimiento' ? '#fef3c7' : '#fee2e2',
                        color: vehicle.estado === 'disponible' ? '#15803d' :
                            vehicle.estado === 'en_uso' ? '#1e40af' :
                                vehicle.estado === 'mantenimiento' ? '#92400e' : '#991b1b'
                    }}>
                        {vehicle.estado === 'disponible' ? '✅ Disponible' :
                            vehicle.estado === 'en_uso' ? '🔧 En Uso' :
                                vehicle.estado === 'mantenimiento' ? '🔧 Mantenimiento' : '❌ Fuera Servicio'}
                    </span>
                </div>
            </div>
        </div>
    </div>
);

// Componente del formulario de mantenimiento
const MaintenanceForm = ({
    form,
    setForm,
    onSubmit,
    onPhotoUpload,
    onDeletePhoto,
    uploadingPhotos,
    uploadProgress,
    loading,
    isMobile,
    vehicle,
    currentUser  // AGREGAR ESTE PROP

}) => {
    return (
        <form onSubmit={onSubmit} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
        }}>
            <h3 style={{
                margin: '0 0 25px 0',
                fontSize: '20px',
                color: '#1f2937'
            }}>
                📝 Registrar Nuevo Mantenimiento
            </h3>

            {/* Información básica */}
            <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <h4 style={{
                    margin: '0 0 15px 0',
                    fontSize: '16px',
                    color: '#374151'
                }}>
                    📋 Información General
                </h4>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '15px'
                }}>
                    // En MaintenanceForm, después del campo de fecha agregar:
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Hora del Mantenimiento *
                        </label>
                        <input
                            type="time"
                            required
                            value={form.hora}
                            onChange={(e) => setForm({ ...form, hora: e.target.value })}
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Fecha del Mantenimiento *
                        </label>
                        <input
                            type="date"
                            required
                            value={form.fecha}
                            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Tipo de Mantenimiento *
                        </label>
                        <select
                            required
                            value={form.tipoMantenimiento}
                            onChange={(e) => setForm({ ...form, tipoMantenimiento: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        >
                            <option value="preventivo">Preventivo</option>
                            <option value="correctivo">Correctivo</option>
                            <option value="emergencia">Emergencia</option>
                            <option value="inspeccion">Inspección</option>
                        </select>
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Kilometraje Actual
                        </label>
                        <input
                            type="number"
                            value={form.kilometraje}
                            onChange={(e) => setForm({ ...form, kilometraje: e.target.value })}
                            placeholder={vehicle.kilometraje || '0'}
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Realizado Por *
                        </label>
                        <input
                            type="text"
                            required
                            value={form.realizadoPor}
                            onChange={(e) => setForm({ ...form, realizadoPor: e.target.value })}
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Taller/Lugar
                        </label>
                        <input
                            type="text"
                            value={form.tallerResponsable}
                            onChange={(e) => setForm({ ...form, tallerResponsable: e.target.value })}
                            placeholder="Nombre del taller o lugar"
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Costo (CLP)
                        </label>
                        <input
                            type="number"
                            value={form.costoMantenimiento}
                            onChange={(e) => setForm({ ...form, costoMantenimiento: e.target.value })}
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

            {/* Checklist de inspección de seguridad */}
            <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <h4 style={{
                    margin: '0 0 15px 0',
                    fontSize: '16px',
                    color: '#374151'
                }}>
                    🔍 Inspección de Elementos de Seguridad
                </h4>

                <div style={{
                    display: 'grid',
                    gap: '15px'
                }}>
                    {/* Gata */}
                    <InspectionItem
                        label="🔧 Gata"
                        value={form.gata}
                        onChange={(value) => setForm({ ...form, gata: value })}
                        observations={form.gataObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, gataObservaciones: value })}
                    />

                    {/* Chaleco Reflectante */}
                    <InspectionItem
                        label="🦺 Chaleco Reflectante"
                        value={form.chalecoReflectante}
                        onChange={(value) => setForm({ ...form, chalecoReflectante: value })}
                        observations={form.chalecoObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, chalecoObservaciones: value })}
                    />

                    {/* Llave de Repuesto */}
                    <InspectionItem
                        label="🔑 Llave de Repuesto"
                        value={form.llaveRepuesto}
                        onChange={(value) => setForm({ ...form, llaveRepuesto: value })}
                        observations={form.llaveObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, llaveObservaciones: value })}
                    />

                    {/* Cinturón de Seguridad */}
                    <InspectionItem
                        label="🔒 Cinturón de Seguridad"
                        value={form.cinturon}
                        onChange={(value) => setForm({ ...form, cinturon: value })}
                        observations={form.cinturonObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, cinturonObservaciones: value })}
                    />

                    {/* Parabrisas */}
                    <InspectionItem
                        label="🪟 Estado del Parabrisas"
                        value={form.parabrisas}
                        onChange={(value) => setForm({ ...form, parabrisas: value })}
                        observations={form.parabrisasObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, parabrisasObservaciones: value })}
                        noAplica={false}
                    />

                    {/* Luces de Freno */}
                    <InspectionItem
                        label="🔴 Luces de Freno"
                        value={form.lucesFreno}
                        onChange={(value) => setForm({ ...form, lucesFreno: value })}
                        observations={form.lucesObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, lucesObservaciones: value })}
                        noAplica={false}
                    />

                    {/* Luces Delanteras */}
                    <InspectionItem
                        label="💡 Luces Delanteras"
                        value={form.lucesDelanteras}
                        onChange={(value) => setForm({ ...form, lucesDelanteras: value })}
                        observations={form.lucesDObservaciones}
                        onObservationsChange={(value) => setForm({ ...form, lucesDObservaciones: value })}
                        noAplica={false}
                    />
                </div>
            </div>

            {/* Trabajos realizados */}
            <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <h4 style={{
                    margin: '0 0 15px 0',
                    fontSize: '16px',
                    color: '#374151'
                }}>
                    ✅ Trabajos Realizados
                </h4>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '10px'
                }}>
                    {[
                        { key: 'cambioAceite', label: '🛢️ Cambio de Aceite' },
                        { key: 'filtroAire', label: '💨 Filtro de Aire' },
                        { key: 'filtroAceite', label: '🔧 Filtro de Aceite' },
                        { key: 'filtroCombustible', label: '⛽ Filtro de Combustible' },
                        { key: 'revisionFrenos', label: '🛑 Revisión de Frenos' },
                        { key: 'revisionNeumaticos', label: '🛞 Revisión de Neumáticos' },
                        { key: 'revisionSuspension', label: '🔩 Revisión de Suspensión' },
                        { key: 'revisionDireccion', label: '🎯 Revisión de Dirección' },
                        { key: 'revisionBateria', label: '🔋 Revisión de Batería' },
                        { key: 'revisionLuces', label: '💡 Revisión de Luces' },
                        { key: 'nivelLiquidos', label: '💧 Nivel de Líquidos' }
                    ].map(item => (
                        <label key={item.key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            background: form[item.key] ? '#dcfce7' : '#f9fafb',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}>
                            <input
                                type="checkbox"
                                checked={form[item.key]}
                                onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer'
                                }}
                            />
                            <span style={{
                                fontSize: '14px',
                                color: '#374151'
                            }}>
                                {item.label}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Observaciones generales */}
            <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <h4 style={{
                    margin: '0 0 15px 0',
                    fontSize: '16px',
                    color: '#374151'
                }}>
                    📝 Observaciones y Próximo Mantenimiento
                </h4>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{
                        display: 'block',
                        marginBottom: '6px',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                    }}>
                        Observaciones Generales
                    </label>
                    <textarea
                        value={form.observacionesGenerales}
                        onChange={(e) => setForm({ ...form, observacionesGenerales: e.target.value })}
                        placeholder="Detalle cualquier observación adicional..."
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            resize: 'none'
                        }}
                    />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: '15px'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Próximo Mantenimiento (Fecha)
                        </label>
                        <input
                            type="date"
                            value={form.proximoMantenimientoFecha}
                            onChange={(e) => setForm({ ...form, proximoMantenimientoFecha: e.target.value })}
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
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Próximo Mantenimiento (Kilometraje)
                        </label>
                        <input
                            type="number"
                            value={form.proximoMantenimientoKm}
                            onChange={(e) => setForm({ ...form, proximoMantenimientoKm: e.target.value })}
                            placeholder="Ej: 15000"
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

            {/* Sección de fotos */}
            <div style={{ marginBottom: '25px' }}>
                <h4 style={{
                    margin: '0 0 15px 0',
                    fontSize: '16px',
                    color: '#374151'
                }}>
                    📷 Fotos del Mantenimiento
                </h4>

                {/* Fotos existentes */}
                {form.fotos && form.fotos.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '10px',
                        marginBottom: '15px'
                    }}>
                        {form.fotos.map((foto, index) => (
                            <div key={index} style={{
                                position: 'relative',
                                background: '#f9fafb',
                                borderRadius: '8px',
                                padding: '10px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <img
                                    src={foto.url}
                                    alt={`Foto ${index + 1}`}
                                    style={{
                                        width: '100%',
                                        height: '120px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        marginBottom: '8px'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => onDeletePhoto(index)}
                                    style={{
                                        position: 'absolute',
                                        top: '5px',
                                        right: '5px',
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
                                <div style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {foto.nombre}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Botón de carga de fotos */}
                <div>
                    <input
                        type="file"
                        id="maintenance-photos"
                        multiple
                        accept="image/*"
                        onChange={(e) => onPhotoUpload(e.target.files)}
                        style={{ display: 'none' }}
                        disabled={uploadingPhotos}
                    />
                    <label
                        htmlFor="maintenance-photos"
                        style={{
                            display: 'inline-block',
                            padding: '10px 20px',
                            background: uploadingPhotos ? '#9ca3af' : '#3b82f6',
                            color: 'white',
                            borderRadius: '6px',
                            cursor: uploadingPhotos ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}
                    >
                        {uploadingPhotos ? `⏳ Subiendo... ${uploadProgress}%` : '📤 Agregar Fotos'}
                    </label>
                </div>
            </div>

            {/* Botones de acción */}
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
                    {loading ? '⏳ Guardando...' : '✅ Guardar Mantenimiento'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        // Resetear el formulario directamente aquí
                        setForm({
                            fecha: new Date().toISOString().split('T')[0],
                            tipoMantenimiento: 'preventivo',
                            kilometraje: '',
                            horasUso: '',
                            gata: 'no_aplica',
                            gataObservaciones: '',
                            chalecoReflectante: 'no_aplica',
                            chalecoObservaciones: '',
                            llaveRepuesto: 'no_aplica',
                            llaveObservaciones: '',
                            cinturon: 'no_aplica',
                            cinturonObservaciones: '',
                            parabrisas: 'bueno',
                            parabrisasObservaciones: '',
                            lucesFreno: 'bueno',
                            lucesObservaciones: '',
                            lucesDelanteras: 'bueno',
                            lucesDObservaciones: '',
                            cambioAceite: false,
                            filtroAire: false,
                            filtroAceite: false,
                            filtroCombustible: false,
                            revisionFrenos: false,
                            revisionNeumaticos: false,
                            revisionSuspension: false,
                            revisionDireccion: false,
                            revisionBateria: false,
                            revisionLuces: false,
                            nivelLiquidos: false,
                            observacionesGenerales: '',
                            proximoMantenimientoKm: '',
                            proximoMantenimientoFecha: '',
                            realizadoPor: currentUser.name || currentUser.email,
                            tallerResponsable: '',
                            costoMantenimiento: 0,
                            fotos: []
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
                    Limpiar Formulario
                </button>
            </div>
        </form>
    );
};

// Componente para items de inspección
const InspectionItem = ({
    label,
    value,
    onChange,
    observations,
    onObservationsChange,
    noAplica = true
}) => {
    return (
        <div style={{
            padding: '15px',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: observations ? '10px' : '0'
            }}>
                <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151'
                }}>
                    {label}
                </span>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={label}
                            value="bueno"
                            checked={value === 'bueno'}
                            onChange={() => onChange('bueno')}
                        />
                        <span style={{ fontSize: '13px' }}>✅ Bueno</span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={label}
                            value="requiere_atencion"
                            checked={value === 'requiere_atencion'}
                            onChange={() => onChange('requiere_atencion')}
                        />
                        <span style={{ fontSize: '13px' }}>⚠️ Requiere Atención</span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={label}
                            value="malo"
                            checked={value === 'malo'}
                            onChange={() => onChange('malo')}
                        />
                        <span style={{ fontSize: '13px' }}>❌ Malo</span>
                    </label>

                    {noAplica && (
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer'
                        }}>
                            <input
                                type="radio"
                                name={label}
                                value="no_aplica"
                                checked={value === 'no_aplica'}
                                onChange={() => onChange('no_aplica')}
                            />
                            <span style={{ fontSize: '13px' }}>N/A</span>
                        </label>
                    )}
                </div>
            </div>

            {(value === 'requiere_atencion' || value === 'malo') && (
                <input
                    type="text"
                    value={observations}
                    onChange={(e) => onObservationsChange(e.target.value)}
                    placeholder="Especifique el problema..."
                    style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                    }}
                />
            )}
        </div>
    );
};

// Componente para el historial
const MaintenanceHistory = ({ history, isMobile }) => {
    if (history.length === 0) {
        return (
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                color: '#6b7280'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
                <p style={{ fontSize: '16px' }}>No hay mantenimientos registrados</p>
                <p style={{ fontSize: '14px' }}>Registra el primer mantenimiento usando el formulario</p>
            </div>
        );
    }

    return (
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
                <h3 style={{
                    margin: 0,
                    fontSize: '20px',
                    color: '#1f2937'
                }}>
                    📚 Historial de Mantenimientos ({history.length})
                </h3>
            </div>

            <div style={{ padding: '20px' }}>
                {history.map((maintenance, index) => (
                    <MaintenanceCard
                        key={maintenance.id}
                        maintenance={maintenance}
                        isLast={index === history.length - 1}
                        isMobile={isMobile}
                    />
                ))}
            </div>
        </div>
    );
};

// Componente para cada tarjeta de mantenimiento
const MaintenanceCard = ({ maintenance, isLast, isMobile }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div style={{
            paddingBottom: isLast ? '0' : '20px',
            marginBottom: isLast ? '0' : '20px',
            borderBottom: isLast ? 'none' : '1px solid #e5e7eb'
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    cursor: 'pointer',
                    padding: '15px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start'
                }}>
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginBottom: '8px'
                        }}>
                            <span style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#1f2937'
                            }}>
                                {new Date(maintenance.fecha).toLocaleDateString('es-CL')}
                                {maintenance.hora && (
                                    <span style={{ marginLeft: '10px', fontSize: '14px', color: '#6b7280' }}>
                                        {maintenance.hora} hrs
                                    </span>
                                )}
                            </span>
                            <span style={{
                                padding: '4px 8px',
                                background: maintenance.tipoMantenimiento === 'preventivo' ? '#dcfce7' :
                                    maintenance.tipoMantenimiento === 'correctivo' ? '#fef3c7' : '#fee2e2',
                                color: maintenance.tipoMantenimiento === 'preventivo' ? '#15803d' :
                                    maintenance.tipoMantenimiento === 'correctivo' ? '#92400e' : '#991b1b',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500'
                            }}>
                                {maintenance.tipoMantenimiento.toUpperCase()}
                            </span>
                        </div>

                        <div style={{
                            fontSize: '14px',
                            color: '#6b7280'
                        }}>
                            <div>👤 {maintenance.realizadoPor}</div>
                            {maintenance.kilometraje && (
                                <div>📏 {maintenance.kilometraje.toLocaleString()} km</div>
                            )}
                            {maintenance.costoMantenimiento > 0 && (
                                <div>💰 ${maintenance.costoMantenimiento.toLocaleString()}</div>
                            )}
                        </div>
                    </div>

                    <span style={{
                        fontSize: '20px',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s'
                    }}>
                        ▼
                    </span>
                </div>
            </div>

            {expanded && (
                <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                }}>
                    {/* Trabajos realizados */}
                    {(() => {
                        const trabajos = [
                            { key: 'cambioAceite', label: '🛢️ Cambio de Aceite' },
                            { key: 'filtroAire', label: '💨 Filtro de Aire' },
                            { key: 'filtroAceite', label: '🔧 Filtro de Aceite' },
                            { key: 'filtroCombustible', label: '⛽ Filtro de Combustible' },
                            { key: 'revisionFrenos', label: '🛑 Revisión de Frenos' },
                            { key: 'revisionNeumaticos', label: '🛞 Revisión de Neumáticos' },
                            { key: 'revisionSuspension', label: '🔩 Revisión de Suspensión' },
                            { key: 'revisionDireccion', label: '🎯 Revisión de Dirección' },
                            { key: 'revisionBateria', label: '🔋 Revisión de Batería' },
                            { key: 'revisionLuces', label: '💡 Revisión de Luces' },
                            { key: 'nivelLiquidos', label: '💧 Nivel de Líquidos' }
                        ].filter(t => maintenance[t.key]);

                        if (trabajos.length > 0) {
                            return (
                                <div style={{ marginBottom: '15px' }}>
                                    <h5 style={{
                                        margin: '0 0 10px 0',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151'
                                    }}>
                                        Trabajos Realizados:
                                    </h5>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px'
                                    }}>
                                        {trabajos.map(trabajo => (
                                            <span key={trabajo.key} style={{
                                                padding: '4px 8px',
                                                background: '#dcfce7',
                                                color: '#15803d',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                {trabajo.label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Inspecciones */}
                    {(() => {
                        const inspecciones = [
                            { key: 'gata', label: '🔧 Gata', value: maintenance.gata, obs: maintenance.gataObservaciones },
                            { key: 'chalecoReflectante', label: '🦺 Chaleco', value: maintenance.chalecoReflectante, obs: maintenance.chalecoObservaciones },
                            { key: 'llaveRepuesto', label: '🔑 Llave Repuesto', value: maintenance.llaveRepuesto, obs: maintenance.llaveObservaciones },
                            { key: 'cinturon', label: '🔒 Cinturón', value: maintenance.cinturon, obs: maintenance.cinturonObservaciones },
                            { key: 'parabrisas', label: '🪟 Parabrisas', value: maintenance.parabrisas, obs: maintenance.parabrisasObservaciones },
                            { key: 'lucesFreno', label: '🔴 Luces Freno', value: maintenance.lucesFreno, obs: maintenance.lucesObservaciones },
                            { key: 'lucesDelanteras', label: '💡 Luces Delanteras', value: maintenance.lucesDelanteras, obs: maintenance.lucesDObservaciones }
                        ].filter(i => i.value && i.value !== 'no_aplica');

                        if (inspecciones.length > 0) {
                            return (
                                <div style={{ marginBottom: '15px' }}>
                                    <h5 style={{
                                        margin: '0 0 10px 0',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        color: '#374151'
                                    }}>
                                        Inspección de Seguridad:
                                    </h5>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '8px'
                                    }}>
                                        {inspecciones.map(insp => (
                                            <div key={insp.key} style={{
                                                padding: '6px 10px',
                                                background: insp.value === 'bueno' ? '#dcfce7' :
                                                    insp.value === 'requiere_atencion' ? '#fef3c7' : '#fee2e2',
                                                borderRadius: '4px',
                                                fontSize: '12px'
                                            }}>
                                                <span style={{ fontWeight: '500' }}>{insp.label}:</span>
                                                <span style={{ marginLeft: '5px' }}>
                                                    {insp.value === 'bueno' ? '✅' :
                                                        insp.value === 'requiere_atencion' ? '⚠️' : '❌'}
                                                </span>
                                                {insp.obs && (
                                                    <div style={{
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        marginTop: '2px'
                                                    }}>
                                                        {insp.obs}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Observaciones */}
                    {maintenance.observacionesGenerales && (
                        <div style={{ marginBottom: '15px' }}>
                            <h5 style={{
                                margin: '0 0 10px 0',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151'
                            }}>
                                Observaciones:
                            </h5>
                            <p style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#6b7280',
                                lineHeight: '1.5'
                            }}>
                                {maintenance.observacionesGenerales}
                            </p>
                        </div>
                    )}

                    {/* Fotos */}
                    {maintenance.fotos && maintenance.fotos.length > 0 && (
                        <div>
                            <h5 style={{
                                margin: '0 0 10px 0',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151'
                            }}>
                                📷 Fotos ({maintenance.fotos.length})
                            </h5>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                                gap: '8px'
                            }}>
                                {maintenance.fotos.map((foto, index) => (
                                    <a
                                        key={index}
                                        href={foto.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <img
                                            src={foto.url}
                                            alt={`Foto ${index + 1}`}
                                            style={{
                                                width: '100%',
                                                height: '80px',
                                                objectFit: 'cover',
                                                borderRadius: '4px',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Próximo mantenimiento */}
                    {(maintenance.proximoMantenimientoFecha || maintenance.proximoMantenimientoKm) && (
                        <div style={{
                            marginTop: '15px',
                            padding: '10px',
                            background: '#f0f9ff',
                            borderRadius: '6px',
                            fontSize: '13px'
                        }}>
                            <strong>📅 Próximo Mantenimiento:</strong>
                            {maintenance.proximoMantenimientoFecha && (
                                <span style={{ marginLeft: '10px' }}>
                                    {new Date(maintenance.proximoMantenimientoFecha).toLocaleDateString('es-CL')}
                                </span>
                            )}
                            {maintenance.proximoMantenimientoKm && (
                                <span style={{ marginLeft: '10px' }}>
                                    o {maintenance.proximoMantenimientoKm.toLocaleString()} km
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VehicleMaintenanceModule;