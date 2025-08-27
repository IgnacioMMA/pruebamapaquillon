// src/components/VehicleMaintenanceModule.js

import React, { useState, useEffect, useCallback } from 'react';
import ServiceCatalogManager from './ServiceCatalogManager';
import { pdfExportService } from '../services/pdfExportService';
import ServiceCatalogSelector from './ServiceCatalogSelector';
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
    set as databaseSet,
    get,
    remove
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


    // Estados para gestión de elementos dinámicos
    const [inspectionItems, setInspectionItems] = useState([]);
    const [workItems, setWorkItems] = useState([]);
    const [showElementsManager, setShowElementsManager] = useState(false);
    const [activeTab, setActiveTab] = useState('inspection'); // 'inspection' o 'works'
    const [elementFilter, setElementFilter] = useState('');
    const [showNewElementForm, setShowNewElementForm] = useState(false);

    // Estado para nuevo elemento
    const [newElement, setNewElement] = useState({
        code: '',
        name: '',
        detail: '',
        type: 'inspection', // 'inspection' o 'work'
        requiresObservation: true
    });

    // Estado del formulario de mantenimiento
    const [maintenanceForm, setMaintenanceForm] = useState({
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().slice(0, 5),
        tipoMantenimiento: 'preventivo',
        kilometraje: '',
        horasUso: '',
        observacionesGenerales: '',
        proximoMantenimientoKm: '',
        proximoMantenimientoFecha: '',
        realizadoPor: currentUser.name || currentUser.email,
        tallerResponsable: '',
        costoMantenimiento: 0,
        fotos: [],
        inspectionData: {}, // Datos dinámicos de inspección
        workData: {}, // Datos dinámicos de trabajos
        serviciosCatalogo: []

    });

    // Cargar elementos de configuración al iniciar
    useEffect(() => {
        loadConfigElements();
    }, []);

    // Cargar elementos de inspección y trabajo desde Firebase
    const loadConfigElements = async () => {
        try {
            // Cargar elementos de inspección
            const inspectionRef = databaseRef(database, 'configuracion/elementosInspeccion');
            onValue(inspectionRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const items = Object.entries(data).map(([id, item]) => ({
                        id,
                        ...item
                    }));
                    setInspectionItems(items);
                }
            });

            // Cargar elementos de trabajo
            const workRef = databaseRef(database, 'configuracion/elementosTrabajo');
            onValue(workRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const items = Object.entries(data).map(([id, item]) => ({
                        id,
                        ...item
                    }));
                    setWorkItems(items);
                }
            });
        } catch (error) {
            console.error('Error al cargar elementos de configuración:', error);
        }
    };

    // Guardar nuevo elemento
    const handleSaveNewElement = async () => {
        if (!newElement.code || !newElement.name) {
            setMessage({
                type: 'error',
                text: '❌ El código y nombre son obligatorios'
            });
            return;
        }

        try {
            const elementData = {
                code: newElement.code.toUpperCase(),
                name: newElement.name,
                detail: newElement.detail,
                requiresObservation: newElement.type === 'inspection' ? newElement.requiresObservation : false,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
            };

            const refPath = newElement.type === 'inspection'
                ? 'configuracion/elementosInspeccion'
                : 'configuracion/elementosTrabajo';

            const elementRef = databaseRef(database, refPath);
            await push(elementRef, elementData);

            setMessage({
                type: 'success',
                text: `✅ Elemento ${newElement.name} creado exitosamente`
            });

            // Resetear formulario
            setNewElement({
                code: '',
                name: '',
                detail: '',
                type: activeTab === 'inspection' ? 'inspection' : 'work',
                requiresObservation: true
            });
            setShowNewElementForm(false);
        } catch (error) {
            console.error('Error al guardar elemento:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al guardar el elemento'
            });
        }
    };

    // Eliminar elemento
    const handleDeleteElement = async (elementId, type) => {
        if (!window.confirm('¿Está seguro de eliminar este elemento?')) {
            return;
        }

        try {
            const refPath = type === 'inspection'
                ? `configuracion/elementosInspeccion/${elementId}`
                : `configuracion/elementosTrabajo/${elementId}`;

            await remove(databaseRef(database, refPath));

            setMessage({
                type: 'success',
                text: '✅ Elemento eliminado exitosamente'
            });
        } catch (error) {
            console.error('Error al eliminar elemento:', error);
            setMessage({
                type: 'error',
                text: '❌ Error al eliminar el elemento'
            });
        }
    };

    // Filtrar elementos
    const getFilteredElements = () => {
        const elements = activeTab === 'inspection' ? inspectionItems : workItems;

        if (!elementFilter) return elements;

        return elements.filter(item =>
            item.name.toLowerCase().includes(elementFilter.toLowerCase()) ||
            item.code.toLowerCase().includes(elementFilter.toLowerCase()) ||
            (item.detail && item.detail.toLowerCase().includes(elementFilter.toLowerCase()))
        );
    };

    // Actualizar datos del formulario cuando se marcan elementos
    const handleInspectionChange = (itemCode, field, value) => {
        setMaintenanceForm(prev => ({
            ...prev,
            inspectionData: {
                ...prev.inspectionData,
                [`${itemCode}_${field}`]: value
            }
        }));
    };

    const handleWorkChange = (itemCode, checked) => {
        setMaintenanceForm(prev => ({
            ...prev,
            workData: {
                ...prev.workData,
                [itemCode]: checked
            }
        }));
    };

    useEffect(() => {
        let filtered = [...maintenanceHistory];

        if (searchPatente) {
            filtered = filtered.filter(m =>
                m.vehiculoPatente?.toLowerCase().includes(searchPatente.toLowerCase()) ||
                m.vehiculoNombre?.toLowerCase().includes(searchPatente.toLowerCase())
            );
        }

        if (searchFechaDesde) {
            filtered = filtered.filter(m =>
                new Date(m.fecha) >= new Date(searchFechaDesde)
            );
        }

        if (searchFechaHasta) {
            filtered = filtered.filter(m =>
                new Date(m.fecha) <= new Date(searchFechaHasta)
            );
        }

        setFilteredHistory(filtered);
    }, [maintenanceHistory, searchPatente, searchFechaDesde, searchFechaHasta, selectedVehicle]);

    useEffect(() => {
        if (selectedVehicle) {
            loadMaintenanceHistory(selectedVehicle.id);
            setSearchPatente('');
            setSearchFechaDesde('');
            setSearchFechaHasta('');
        }
    }, [selectedVehicle]);

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
                setFilteredHistory(historyArray);
            } else {
                setMaintenanceHistory([]);
                setFilteredHistory([]);
            }
        });

        return () => off(historyRef);
    };

    const handlePhotoUpload = async (files) => {
        if (!files || files.length === 0) return;

        setUploadingPhotos(true);
        const uploadedPhotos = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                if (!file.type.startsWith('image/')) {
                    setMessage({
                        type: 'error',
                        text: `El archivo ${file.name} no es una imagen válida`
                    });
                    continue;
                }

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

    const handleDeletePhoto = (index) => {
        setMaintenanceForm(prev => ({
            ...prev,
            fotos: prev.fotos.filter((_, i) => i !== index)
        }));
    };

    const handleSaveMaintenance = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const fechaHoraCompleta = `${maintenanceForm.fecha}T${maintenanceForm.hora}:00`;

            const maintenanceData = {
                ...maintenanceForm,
                fechaCompleta: fechaHoraCompleta,
                vehiculoId: selectedVehicle.id,
                vehiculoNombre: selectedVehicle.nombre,
                vehiculoPatente: selectedVehicle.patente,
                fechaRegistro: new Date().toISOString(),
                registradoPor: currentUser.uid,
                registradoPorNombre: currentUser.name || currentUser.email,
                serviciosCatalogo: maintenanceForm.serviciosCatalogo || [], // <-- INCLUIR ESTO
                costoTotal: maintenanceForm.costoMantenimiento // <-- INCLUIR ESTO
            };

            const maintenanceRef = databaseRef(database, `mantenimientos/${selectedVehicle.id}`);
            const newMaintenanceRef = push(maintenanceRef);
            await databaseSet(newMaintenanceRef, maintenanceData);

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

    const resetForm = () => {
        setMaintenanceForm({
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toTimeString().slice(0, 5),
            tipoMantenimiento: 'preventivo',
            kilometraje: '',
            horasUso: '',
            observacionesGenerales: '',
            proximoMantenimientoKm: '',
            proximoMantenimientoFecha: '',
            realizadoPor: currentUser.name || currentUser.email,
            tallerResponsable: '',
            costoMantenimiento: 0,
            fotos: [],
            inspectionData: {},
            workData: {}
        });
    };

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

            {/* Modal de Gestión de Elementos */}
            {showElementsManager && (
                <ElementsManagerModal
                    show={showElementsManager}
                    onClose={() => setShowElementsManager(false)}
                    inspectionItems={inspectionItems}
                    workItems={workItems}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    elementFilter={elementFilter}
                    setElementFilter={setElementFilter}
                    showNewElementForm={showNewElementForm}
                    setShowNewElementForm={setShowNewElementForm}
                    newElement={newElement}
                    setNewElement={setNewElement}
                    handleSaveNewElement={handleSaveNewElement}
                    handleDeleteElement={handleDeleteElement}
                    getFilteredElements={getFilteredElements}
                    isMobile={isMobile}
                />
            )}

            {!selectedVehicle ? (
                <VehicleSelectionGrid
                    vehiculos={vehiculos}
                    onSelectVehicle={setSelectedVehicle}
                    isMobile={isMobile}
                />
            ) : (
                <>
                    <VehicleInfoCard
                        vehicle={selectedVehicle}
                        isMobile={isMobile}
                    />

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
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '20px',
                        flexWrap: 'wrap'
                    }}>

                        {/* AGREGAR ESTE BOTÓN */}
                        <button
                            onClick={() => setShowElementsManager(true)}
                            style={{
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            ⚙️ Gestión de Elementos
                        </button>
                    </div>

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
                            currentUser={currentUser}
                            inspectionItems={inspectionItems}
                            workItems={workItems}
                            handleInspectionChange={handleInspectionChange}
                            handleWorkChange={handleWorkChange}
                        />
                    )}

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

                    <MaintenanceHistory
                        history={filteredHistory}
                        isMobile={isMobile}
                        vehicle={selectedVehicle}
                        currentUser={currentUser}
                        inspectionItems={inspectionItems}
                        workItems={workItems}
                    />
                </>
            )}
        </div>
    );
};

// Modal de Gestión de Elementos
const ElementsManagerModal = ({
    show,
    onClose,
    inspectionItems,
    workItems,
    activeTab,
    setActiveTab,
    elementFilter,
    setElementFilter,
    showNewElementForm,
    setShowNewElementForm,
    newElement,
    setNewElement,
    handleSaveNewElement,
    handleDeleteElement,
    getFilteredElements,
    isMobile
}) => {
    const [editingElement, setEditingElement] = useState(null);
    const [editForm, setEditForm] = useState({
        code: '',
        name: '',
        detail: '',
        requiresObservation: false
    });
    if (!show) return null;

    // Función para iniciar edición
    const startEditing = (item) => {
        setEditingElement(item.id);
        setEditForm({
            code: item.code,
            name: item.name,
            detail: item.detail || '',
            requiresObservation: item.requiresObservation || false
        });
        setShowNewElementForm(false);
    };
    const handleSaveEdit = async (itemId) => {
        if (!editForm.code || !editForm.name) {
            alert('El código y nombre son obligatorios');
            return;
        }

        try {
            const refPath = activeTab === 'inspection'
                ? `configuracion/elementosInspeccion/${itemId}`
                : `configuracion/elementosTrabajo/${itemId}`;

            const elementRef = databaseRef(database, refPath);

            await update(elementRef, {
                code: editForm.code.toUpperCase(),
                name: editForm.name,
                detail: editForm.detail,
                requiresObservation: activeTab === 'inspection' ? editForm.requiresObservation : false,
                updatedAt: new Date().toISOString()
            });

            setEditingElement(null);
            setEditForm({
                code: '',
                name: '',
                detail: '',
                requiresObservation: false
            });
        } catch (error) {
            console.error('Error al actualizar elemento:', error);
            alert('Error al actualizar el elemento');
        }
    };
    // Función para cancelar edición
    const cancelEdit = () => {
        setEditingElement(null);
        setEditForm({
            code: '',
            name: '',
            detail: '',
            requiresObservation: false
        });
    };

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '12px',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header del Modal */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '20px',
                        color: '#1f2937'
                    }}>
                        ⚙️ Gestión de Elementos de Mantenimiento
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 12px',
                            background: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        ✕ Cerrar
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '0 20px'
                }}>
                    <button
                        onClick={() => {
                            setActiveTab('inspection');
                            setNewElement(prev => ({ ...prev, type: 'inspection' }));
                        }}
                        style={{
                            padding: '12px 24px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'inspection' ? '2px solid #3b82f6' : '2px solid transparent',
                            color: activeTab === 'inspection' ? '#3b82f6' : '#6b7280',
                            fontSize: '14px',
                            fontWeight: activeTab === 'inspection' ? '600' : '400',
                            cursor: 'pointer'
                        }}
                    >
                        🔍 Elementos de Inspección ({inspectionItems.length})
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('works');
                            setNewElement(prev => ({ ...prev, type: 'work' }));
                        }}
                        style={{
                            padding: '12px 24px',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'works' ? '2px solid #3b82f6' : '2px solid transparent',
                            color: activeTab === 'works' ? '#3b82f6' : '#6b7280',
                            fontSize: '14px',
                            fontWeight: activeTab === 'works' ? '600' : '400',
                            cursor: 'pointer'
                        }}
                    >
                        ✅ Trabajos Realizados ({workItems.length})
                    </button>
                </div>

                {/* Contenido del Tab */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '20px'
                }}>
                    {/* Barra de búsqueda y botón de nuevo */}
                    <div style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '20px'
                    }}>
                        <input
                            type="text"
                            placeholder="Buscar por código, nombre o detalle..."
                            value={elementFilter}
                            onChange={(e) => setElementFilter(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                        <button
                            onClick={() => setShowNewElementForm(!showNewElementForm)}
                            style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            {showNewElementForm ? '✖ Cancelar' : '➕ Nuevo Elemento'}
                        </button>
                    </div>

                    {/* Formulario de nuevo elemento */}
                    {showNewElementForm && (
                        <div style={{
                            padding: '20px',
                            background: '#f9fafb',
                            borderRadius: '8px',
                            marginBottom: '20px'
                        }}>
                            <h4 style={{
                                margin: '0 0 15px 0',
                                fontSize: '16px',
                                color: '#374151'
                            }}>
                                Crear Nuevo Elemento de {activeTab === 'inspection' ? 'Inspección' : 'Trabajo'}
                            </h4>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr',
                                gap: '15px'
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        color: '#374151'
                                    }}>
                                        Código *
                                    </label>
                                    <input
                                        type="text"
                                        value={newElement.code}
                                        onChange={(e) => setNewElement(prev => ({ ...prev, code: e.target.value }))}
                                        placeholder="Ej: INSP001"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        marginBottom: '6px',
                                        fontSize: '13px',
                                        color: '#374151'
                                    }}>
                                        Nombre *
                                    </label>
                                    <input
                                        type="text"
                                        value={newElement.name}
                                        onChange={(e) => setNewElement(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Ej: Revisión de frenos delanteros"
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: '15px' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '6px',
                                    fontSize: '13px',
                                    color: '#374151'
                                }}>
                                    Detalle (opcional)
                                </label>
                                <textarea
                                    value={newElement.detail}
                                    onChange={(e) => setNewElement(prev => ({ ...prev, detail: e.target.value }))}
                                    placeholder="Descripción detallada del elemento..."
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        resize: 'none'
                                    }}
                                />
                            </div>

                            {activeTab === 'inspection' && (
                                <div style={{ marginTop: '15px' }}>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={newElement.requiresObservation}
                                            onChange={(e) => setNewElement(prev => ({ ...prev, requiresObservation: e.target.checked }))}
                                        />
                                        <span style={{ fontSize: '14px', color: '#374151' }}>
                                            Requiere observaciones cuando hay problemas
                                        </span>
                                    </label>
                                </div>
                            )}

                            <button
                                onClick={handleSaveNewElement}
                                style={{
                                    marginTop: '15px',
                                    padding: '10px 20px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                💾 Guardar Elemento
                            </button>
                        </div>
                    )}

                    {/* Lista de elementos */}
                    <div style={{
                        display: 'grid',
                        gap: '10px'
                    }}>
                        {getFilteredElements().length === 0 ? (
                            <div style={{
                                padding: '40px',
                                textAlign: 'center',
                                color: '#6b7280'
                            }}>
                                <div style={{ fontSize: '32px', marginBottom: '10px' }}>
                                    {activeTab === 'inspection' ? '🔍' : '✅'}
                                </div>
                                <p>No hay elementos {activeTab === 'inspection' ? 'de inspección' : 'de trabajo'} configurados</p>
                                <p style={{ fontSize: '14px' }}>Crea tu primer elemento usando el botón de arriba</p>
                            </div>
                        ) : (
                            getFilteredElements().map(item => (
                                <div key={item.id} style={{
                                    padding: '15px',
                                    background: editingElement === item.id ? '#f0f9ff' : 'white',
                                    border: '1px solid',
                                    borderColor: editingElement === item.id ? '#3b82f6' : '#e5e7eb',
                                    borderRadius: '8px'
                                }}>
                                    {editingElement === item.id ? (
                                        // Modo edición
                                        <div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: isMobile ? '1fr' : '150px 1fr',
                                                gap: '10px',
                                                marginBottom: '10px'
                                            }}>
                                                <input
                                                    type="text"
                                                    value={editForm.code}
                                                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                                                    placeholder="Código"
                                                    style={{
                                                        padding: '6px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    placeholder="Nombre"
                                                    style={{
                                                        padding: '6px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        fontSize: '14px'
                                                    }}
                                                />
                                            </div>
                                            <textarea
                                                value={editForm.detail}
                                                onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })}
                                                placeholder="Detalle (opcional)"
                                                rows={2}
                                                style={{
                                                    width: '100%',
                                                    padding: '6px',
                                                    border: '1px solid #d1d5db',
                                                    borderRadius: '4px',
                                                    fontSize: '13px',
                                                    resize: 'none',
                                                    marginBottom: '10px'
                                                }}
                                            />
                                            {activeTab === 'inspection' && (
                                                <label style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '10px',
                                                    cursor: 'pointer'
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.requiresObservation}
                                                        onChange={(e) => setEditForm({ ...editForm, requiresObservation: e.target.checked })}
                                                    />
                                                    <span style={{ fontSize: '13px', color: '#374151' }}>
                                                        Requiere observaciones
                                                    </span>
                                                </label>
                                            )}
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleSaveEdit(item.id)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#22c55e',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    💾 Guardar
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    style={{
                                                        padding: '6px 12px',
                                                        background: '#6b7280',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Modo visualización
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    marginBottom: '8px'
                                                }}>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        background: '#dbeafe',
                                                        color: '#1e40af',
                                                        borderRadius: '4px',
                                                        fontSize: '12px',
                                                        fontWeight: '600'
                                                    }}>
                                                        {item.code}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '15px',
                                                        fontWeight: '500',
                                                        color: '#1f2937'
                                                    }}>
                                                        {item.name}
                                                    </span>
                                                    {item.requiresObservation && (
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            background: '#fef3c7',
                                                            color: '#92400e',
                                                            borderRadius: '4px',
                                                            fontSize: '11px'
                                                        }}>
                                                            Requiere obs.
                                                        </span>
                                                    )}
                                                </div>
                                                {item.detail && (
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '13px',
                                                        color: '#6b7280',
                                                        lineHeight: '1.4'
                                                    }}>
                                                        {item.detail}
                                                    </p>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => startEditing(item)}
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
                                                    onClick={() => handleDeleteElement(item.id, activeTab === 'inspection' ? 'inspection' : 'work')}
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
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Componente para selección de vehículo (sin cambios)
const VehicleSelectionGrid = ({ vehiculos, onSelectVehicle, isMobile }) => {
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

    const filteredVehiculos = vehiculos.filter(vehicle => {
        const matchesSearch =
            vehicle.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.patente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vehicle.modelo?.toLowerCase().includes(searchTerm.toLowerCase());

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
// Componente del formulario de mantenimiento modificado
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
    currentUser,
    inspectionItems,
    workItems,
    handleInspectionChange,
    handleWorkChange
}) => {
    const [inspectionFilter, setInspectionFilter] = useState('');
    const [workFilter, setWorkFilter] = useState('');

    // Funciones de filtrado
    const getFilteredInspectionItems = () => {
        if (!inspectionFilter) return inspectionItems;

        return inspectionItems.filter(item =>
            item.name.toLowerCase().includes(inspectionFilter.toLowerCase()) ||
            item.code.toLowerCase().includes(inspectionFilter.toLowerCase()) ||
            (item.detail && item.detail.toLowerCase().includes(inspectionFilter.toLowerCase()))
        );
    };

    const getFilteredWorkItems = () => {
        if (!workFilter) return workItems;

        return workItems.filter(item =>
            item.name.toLowerCase().includes(workFilter.toLowerCase()) ||
            item.code.toLowerCase().includes(workFilter.toLowerCase()) ||
            (item.detail && item.detail.toLowerCase().includes(workFilter.toLowerCase()))
        );
    };

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
                <ServiceCatalogSelector
                    onAddService={(servicio) => {
                        setForm(prev => {
                            const nuevosServicios = [...(prev.serviciosCatalogo || []), servicio];
                            const nuevoTotal = nuevosServicios.reduce((total, s) =>
                                total + (s.totales?.total || 0), 0
                            );

                            return {
                                ...prev,
                                serviciosCatalogo: nuevosServicios,
                                costoMantenimiento: nuevoTotal
                            };
                        });
                    }}
                    selectedServices={form.serviciosCatalogo || []}
                    onRemoveService={(idTemp) => {
                        setForm(prev => {
                            const serviciosActualizados = prev.serviciosCatalogo.filter(
                                s => s.idTemp !== idTemp
                            );
                            const nuevoTotal = serviciosActualizados.reduce((total, s) =>
                                total + (s.totales?.total || 0), 0
                            );

                            return {
                                ...prev,
                                serviciosCatalogo: serviciosActualizados,
                                costoMantenimiento: nuevoTotal
                            };
                        });
                    }}
                    isMobile={isMobile}
                />

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
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

            {/* Checklist de inspección de seguridad - DINÁMICO */}
            {inspectionItems.length > 0 && (
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
                        🔍 Elementos de Inspección de Seguridad
                    </h4>

                    {/* Barra de búsqueda para inspección */}
                    <div style={{
                        marginBottom: '15px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        <input
                            type="text"
                            placeholder="Buscar elemento de inspección..."
                            value={inspectionFilter}
                            onChange={(e) => setInspectionFilter(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                        {inspectionFilter && (
                            <button
                                type="button"
                                onClick={() => setInspectionFilter('')}
                                style={{
                                    padding: '8px 12px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Limpiar
                            </button>
                        )}
                        <span style={{
                            padding: '6px 12px',
                            background: '#f3f4f6',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#6b7280',
                            minWidth: '60px',
                            textAlign: 'center'
                        }}>
                            {getFilteredInspectionItems().length} / {inspectionItems.length}
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gap: '15px'
                    }}>
                        {getFilteredInspectionItems().map(item => (
                            <DynamicInspectionItem
                                key={item.code}
                                item={item}
                                value={form.inspectionData[`${item.code}_status`] || 'no_aplica'}
                                observations={form.inspectionData[`${item.code}_observations`] || ''}
                                onChange={(field, value) => handleInspectionChange(item.code, field, value)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Trabajos realizados - DINÁMICO */}
            {workItems.length > 0 && (
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

                    {/* Barra de búsqueda para trabajos */}
                    <div style={{
                        marginBottom: '15px',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                    }}>
                        <input
                            type="text"
                            placeholder="Buscar trabajo..."
                            value={workFilter}
                            onChange={(e) => setWorkFilter(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                        {workFilter && (
                            <button
                                type="button"
                                onClick={() => setWorkFilter('')}
                                style={{
                                    padding: '8px 12px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Limpiar
                            </button>
                        )}
                        <span style={{
                            padding: '6px 12px',
                            background: '#f3f4f6',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#6b7280',
                            minWidth: '60px',
                            textAlign: 'center'
                        }}>
                            {getFilteredWorkItems().length} / {workItems.length}
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                        gap: '10px'
                    }}>
                        {getFilteredWorkItems().map(item => (
                            <label key={item.code} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px',
                                background: form.workData[item.code] ? '#dcfce7' : '#f9fafb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={form.workData[item.code] || false}
                                    onChange={(e) => handleWorkChange(item.code, e.target.checked)}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        cursor: 'pointer'
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <span style={{
                                        fontSize: '14px',
                                        color: '#374151',
                                        fontWeight: '500'
                                    }}>
                                        {item.name}
                                    </span>
                                    {item.detail && (
                                        <div style={{
                                            fontSize: '11px',
                                            color: '#6b7280',
                                            marginTop: '2px'
                                        }}>
                                            {item.detail}
                                        </div>
                                    )}
                                </div>
                                <span style={{
                                    padding: '2px 6px',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    borderRadius: '4px',
                                    fontSize: '10px'
                                }}>
                                    {item.code}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Resto del formulario continúa igual... */}
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
            </div>
        </form>
    );
};
// Componente para items de inspección dinámicos
const DynamicInspectionItem = ({
    item,
    value,
    observations,
    onChange
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
                <div style={{ flex: 1 }}>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151'
                    }}>
                        {item.name}
                    </span>
                    <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '4px',
                        fontSize: '10px'
                    }}>
                        {item.code}
                    </span>
                    {item.detail && (
                        <div style={{
                            fontSize: '12px',
                            color: '#6b7280',
                            marginTop: '4px'
                        }}>
                            {item.detail}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginLeft: '10px' }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={item.code}
                            value="bueno"
                            checked={value === 'bueno'}
                            onChange={() => onChange('status', 'bueno')}
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
                            name={item.code}
                            value="requiere_atencion"
                            checked={value === 'requiere_atencion'}
                            onChange={() => onChange('status', 'requiere_atencion')}
                        />
                        <span style={{ fontSize: '13px' }}>⚠️ Atención</span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={item.code}
                            value="malo"
                            checked={value === 'malo'}
                            onChange={() => onChange('status', 'malo')}
                        />
                        <span style={{ fontSize: '13px' }}>❌ Malo</span>
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer'
                    }}>
                        <input
                            type="radio"
                            name={item.code}
                            value="no_aplica"
                            checked={value === 'no_aplica'}
                            onChange={() => onChange('status', 'no_aplica')}
                        />
                        <span style={{ fontSize: '13px' }}>N/A</span>
                    </label>
                </div>
            </div>

            {item.requiresObservation && (value === 'requiere_atencion' || value === 'malo') && (
                <input
                    type="text"
                    value={observations}
                    onChange={(e) => onChange('observations', e.target.value)}
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
const MaintenanceHistory = ({ history, isMobile, vehicle, currentUser, inspectionItems, workItems }) => {
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
                        vehicle={vehicle}
                        currentUser={currentUser}
                        inspectionItems={inspectionItems}
                        workItems={workItems}
                    />
                ))}
            </div>
        </div>
    );
};

// Componente para cada tarjeta de mantenimiento
const MaintenanceCard = ({ maintenance, isLast, isMobile, vehicle, currentUser, inspectionItems, workItems }) => {
    const [expanded, setExpanded] = useState(false);


    const handleExportSingle = () => {
        if (!vehicle) {
            console.error('Error: No se encontró información del vehículo');
            alert('Error: No se puede exportar el PDF. Falta información del vehículo.');
            return;
        }

        if (!currentUser) {
            console.error('Error: No se encontró información del usuario');
            alert('Error: No se puede exportar el PDF. Falta información del usuario.');
            return;
        }

        try {
            const maintenanceWithVehicle = {
                ...maintenance,
                vehiculoNombre: maintenance.vehiculoNombre || vehicle.nombre,
                vehiculoPatente: maintenance.vehiculoPatente || vehicle.patente
            };

            pdfExportService.exportSingleMaintenanceRecord(
                maintenanceWithVehicle,
                vehicle,
                currentUser
            );
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            alert('Error al generar el PDF. Por favor, intente nuevamente.');
        }
    };

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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleExportSingle();
                            }}
                            style={{
                                padding: '6px 12px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            📄 PDF
                        </button>

                        <span style={{
                            fontSize: '20px',
                            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s'
                        }}>
                            ▼
                        </span>
                    </div>
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
                    {/* Mostrar servicios del catálogo si existen */}
                    {maintenance.serviciosCatalogo && maintenance.serviciosCatalogo.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                            <h5 style={{
                                margin: '0 0 10px 0',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#374151'
                            }}>
                                Servicios Realizados:
                            </h5>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {maintenance.serviciosCatalogo.map((servicio, idx) => (
                                    <div key={idx} style={{
                                        padding: '6px',
                                        background: '#f9fafb',
                                        borderRadius: '4px',
                                        marginBottom: '4px'
                                    }}>
                                        <strong>{servicio.codigo}</strong> - {servicio.descripcion}
                                        <span style={{ marginLeft: '10px' }}>
                                            (Cantidad: {servicio.cantidadServicio}) -
                                            Total: ${servicio.totales.total.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div style={{
                                marginTop: '8px',
                                paddingTop: '8px',
                                borderTop: '1px solid #e5e7eb',
                                fontWeight: '600'
                            }}>
                                Total Servicios: ${maintenance.costoTotal?.toLocaleString() ||
                                    maintenance.costoMantenimiento?.toLocaleString() || '0'}
                            </div>
                        </div>
                    )}
                    {/* Contenido expandido del mantenimiento */}
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