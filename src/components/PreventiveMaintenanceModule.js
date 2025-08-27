// src/components/PreventiveMaintenanceModule.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  ref as databaseRef,
  set as databaseSet,
  push,
  update,
  remove,
  onValue,
  off
} from 'firebase/database';
import ServiceCatalogManager from './ServiceCatalogManager';
import { database } from '../config/firebase';
import { pdfExportService } from '../services/pdfExportService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PreventiveMaintenanceModule = ({ vehiculos, currentUser, isMobile }) => {
  // Estados principales
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showServiceCatalogManager, setShowServiceCatalogManager] = useState(false);


  // Estado para el paso actual del formulario
  const [currentStep, setCurrentStep] = useState(1);

  // Estado para vista activa
  const [activeView, setActiveView] = useState('dashboard');

  // Estado para búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Estado para tipo de repuesto
  const [tipoRepuesto, setTipoRepuesto] = useState('original');

  // Estados para fecha y hora de la solicitud
  const [fechaSolicitud, setFechaSolicitud] = useState(new Date().toISOString().split('T')[0]);
  const [horaSolicitud, setHoraSolicitud] = useState(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }));

  // Estado para servicios preventivos
  const [serviciosPreventivos, setServiciosPreventivos] = useState([]);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');

  const [montoIVA, setMontoIVA] = useState(0);
  const calcularTotales = useCallback(() => {
    let subtotalManoObra = 0;
    let subtotalRepuestos = 0;
    let totalIVA = 0;
    serviciosPreventivos.forEach(servicio => {
      // Si es un servicio del catálogo (tiene totalServicio)
      if (servicio.totalServicio) {
        subtotalManoObra += servicio.totales.manoObra || 0;
        subtotalRepuestos += servicio.totales.repuestosNeto || 0;
        totalIVA += servicio.totales.iva || 0;
      }
      // Si es un servicio manual antiguo (estructura anterior)
      else {
        subtotalManoObra += parseFloat(servicio.manoObra) || 0;
        const repuestoTotal = (parseFloat(servicio.costoRepuesto) || 0) * (parseInt(servicio.cantidadRepuesto) || 1);
        subtotalRepuestos += repuestoTotal;
        totalIVA += Math.round(repuestoTotal * 0.19);
      }
    });

    const valorNeto = subtotalManoObra + subtotalRepuestos;
    const total = subtotalManoObra + subtotalRepuestos + totalIVA;

    return {
      subtotalManoObra,
      subtotalRepuestos,
      valorNeto,
      iva: totalIVA,
      total
    };
  }, [serviciosPreventivos]);
  // Add this function to your PreventiveMaintenanceModule component
  // Place it near the other calculation functions

  const calcularTotalesServicioCatalogo = useCallback((servicio) => {
    const manoObra = parseFloat(servicio.manoObra) || 0;
    const totalRepuestos = servicio.repuestos?.reduce((sum, repuesto) => {
      return sum + (repuesto.cantidad * repuesto.costoUnitario);
    }, 0) || 0;
    const iva = Math.round(totalRepuestos * 0.19);
    const total = manoObra + totalRepuestos + iva;

    return {
      manoObra,
      totalRepuestos,
      iva,
      total
    };
  }, []);

  // Cargar registros de mantenimiento
  useEffect(() => {
    const maintenanceRef = databaseRef(database, 'mantenimientos');
    const unsubscribe = onValue(maintenanceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const maintenanceArray = Object.entries(data).map(([id, maintenance]) => ({
          id,
          ...maintenance
        }));
        setMaintenanceRecords(maintenanceArray);
      } else {
        setMaintenanceRecords([]);
      }
    });

    return () => off(maintenanceRef);
  }, []);
  useEffect(() => {
    const catalogoRef = databaseRef(database, 'catalogo_servicios');
    onValue(catalogoRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const serviciosArray = Object.entries(data).map(([id, servicio]) => ({
          id,
          ...servicio
        }));
        setCatalogoServicios(serviciosArray);
      }
    });
  }, []);

  // Filtrar servicios del catálogo
  const getFilteredCatalogServices = () => {
    if (!catalogSearchTerm) return catalogoServicios;

    const searchLower = catalogSearchTerm.toLowerCase();
    return catalogoServicios.filter(servicio =>
      servicio.codigo.toLowerCase().includes(searchLower) ||
      servicio.descripcion.toLowerCase().includes(searchLower)
    );
  };

  // Agregar servicio del catálogo
  const agregarServicioDeCatalogo = (servicio) => {
    const cantidadInput = document.getElementById(`cantidad-${servicio.id}`);
    const cantidad = parseInt(cantidadInput?.value) || 1;

    const totalRepuestos = (servicio.repuestos?.reduce((sum, rep) =>
      sum + (rep.cantidad * rep.costoUnitario), 0) || 0) * cantidad;
    const iva = Math.round(totalRepuestos * 0.19);
    const manoObraTotal = (servicio.manoObra || 0) * cantidad;
    const totalServicio = manoObraTotal + totalRepuestos + iva;

    const nuevoServicio = {
      id: Date.now(),
      catalogoId: servicio.id,
      codigo: servicio.codigo,
      descripcion: servicio.descripcion,
      manoObra: servicio.manoObra || 0,
      repuestos: servicio.repuestos || [],
      cantidadServicio: cantidad,
      totalRepuestos,
      iva,
      totalServicio,
      totales: {  // <-- AGREGAR ESTA ESTRUCTURA
        manoObra: manoObraTotal,
        repuestosNeto: totalRepuestos,
        iva: iva,
        total: totalServicio
      }
    };

    setServiciosPreventivos([...serviciosPreventivos, nuevoServicio]);
  };

  // Funciones auxiliares
  const agregarServicio = () => {
    const ultimoServicio = serviciosPreventivos[serviciosPreventivos.length - 1];
    // Si el último servicio no tiene datos significativos, no agregar otro
    if (ultimoServicio &&
      !ultimoServicio.servicio &&
      !ultimoServicio.detalle &&
      ultimoServicio.manoObra === 0 &&
      ultimoServicio.costoRepuesto === 0) {
      setMessage({ type: 'warning', text: '⚠️ Complete el servicio actual antes de agregar otro' });
      return;
    }
    const nuevoNumero = serviciosPreventivos.length + 1;
    setServiciosPreventivos([...serviciosPreventivos, {
      id: Date.now(),
      numero: nuevoNumero,
      servicio: '',
      codigo: '',
      detalle: '',
      manoObra: 0,
      costoRepuesto: 0,
      cantidadRepuesto: 1,
      repuestoDescripcion: '',
      iva: 0

    }]);
  };

  const actualizarServicio = (id, campo, valor) => {
    setServiciosPreventivos(serviciosPreventivos.map(s =>
      s.id === id ? { ...s, [campo]: valor } : s
    ));
  };

  const eliminarServicio = (id) => {
    if (serviciosPreventivos.length > 1) {
      const nuevosServicios = serviciosPreventivos.filter(s => s.id !== id);
      const serviciosRenumerados = nuevosServicios.map((s, index) => ({
        ...s,
        numero: index + 1
      }));
      setServiciosPreventivos(serviciosRenumerados);
    }
  };
  // Dentro del componente PreventiveMaintenanceModule, esta es la función completa:

  const handleExportPDF = (record) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Fecha actual
      const now = new Date();
      const fechaGeneracion = now.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Filtrar servicios válidos
      const serviciosValidos = record.serviciosPreventivos.filter(servicio =>
        servicio.servicio ||
        servicio.detalle ||
        servicio.manoObra > 0 ||
        servicio.costoRepuesto > 0
      );

      if (serviciosValidos.length === 0) {
        setMessage({ type: 'error', text: '❌ No hay servicios válidos para exportar' });
        return;
      }

      // Header con color
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, pageWidth, 45, 'F');

      // Título principal
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.text('PRESUPUESTO DE MANTENIMIENTO', pageWidth / 2, 20, { align: 'center' });

      // Subtítulo
      doc.setFontSize(14);
      doc.setFont(undefined, 'normal');
      doc.text('Sistema MapaQuillón', pageWidth / 2, 32, { align: 'center' });

      // Número de presupuesto
      doc.setFontSize(11);
      doc.text(`Presupuesto #${record.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, 40, { align: 'center' });

      // Información de la solicitud
      let yPos = 60;
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('INFORMACIÓN DE LA SOLICITUD', 20, yPos);

      yPos += 10;
      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');

      // Cuadro de información
      const infoSolicitud = [
        ['Fecha de Solicitud:', new Date(record.fechaSolicitud || record.fechaMantenimiento).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
        ['Hora de Solicitud:', `${record.horaSolicitud || 'No especificada'} hrs`],
        ['Solicitado por:', currentUser.name || currentUser.email || 'Usuario del sistema'],
        ['Estado:', 'PRESUPUESTO']
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: infoSolicitud,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 2
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45 },
          1: { cellWidth: 140 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Información del vehículo
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('INFORMACIÓN DEL VEHÍCULO', 20, yPos);

      yPos += 10;

      const vehiculo = vehiculos.find(v => v.id === record.vehiculoId);
      const infoVehiculo = [
        ['Vehículo:', record.vehiculoNombre || 'No especificado'],
        ['Patente:', record.vehiculoPatente || 'No especificada'],
        ['Marca/Modelo:', vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : 'No especificado'],
        ['Año:', vehiculo?.año?.toString() || 'No especificado'],
        ['Kilometraje Actual:', `${record.kilometrajeActual?.toLocaleString('es-CL') || 0} km`],
        ['Tipo de Repuestos:', record.tipoRepuesto === 'original' ? 'ORIGINALES (Garantía oficial)' : 'ALTERNATIVOS (Menor costo)']
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: infoVehiculo,
        theme: 'plain',
        styles: {
          fontSize: 10,
          cellPadding: 2
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45 },
          1: { cellWidth: 140 }
        }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Detalle de servicios
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('DETALLE DE SERVICIOS PRESUPUESTADOS', 20, yPos);

      yPos += 10;

      // Modificar la preparación de datos para la tabla
      const serviciosData = serviciosValidos.map((servicio, index) => {
        const subtotalSinIva = (parseFloat(servicio.manoObra) || 0) +
          ((parseFloat(servicio.costoRepuesto) || 0) * (parseInt(servicio.cantidadRepuesto) || 1));
        const iva = parseFloat(servicio.iva) || 0;
        const totalConIva = subtotalSinIva + iva;

        return [
          (index + 1).toString(),
          servicio.servicio || 'Servicio general',
          servicio.detalle || 'Sin descripción',
          servicio.repuestoDescripcion || 'N/A',
          servicio.cantidadRepuesto?.toString() || '1',
          `$${(parseFloat(servicio.manoObra) || 0).toLocaleString('es-CL')}`,
          `$${(parseFloat(servicio.costoRepuesto) || 0).toLocaleString('es-CL')}`,
          `$${iva.toLocaleString('es-CL')}`, // Agregar columna IVA
          `$${totalConIva.toLocaleString('es-CL')}`
        ];
      });

      // Actualizar los headers de la tabla
      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Servicio', 'Descripción', 'Repuesto', 'Cant.', 'Mano Obra', 'Costo Unit.', 'IVA', 'Total']],
        body: serviciosData,
        theme: 'striped',
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 25 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 20, halign: 'right' },
          6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 18, halign: 'right' }, // IVA
          8: { cellWidth: 22, halign: 'right', fontStyle: 'bold' } // Total
        }
      });

      yPos = doc.lastAutoTable.finalY + 15;

      // Verificar si necesitamos nueva página
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 30;
      }

      // Resumen de costos
      doc.setFillColor(240, 253, 244);
      doc.rect(pageWidth - 100, yPos - 5, 85, 70, 'F');

      doc.setTextColor(31, 41, 55);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');

      const startX = pageWidth - 95;
      doc.text('Subtotal Mano de Obra:', startX, yPos + 5);
      doc.text(`$${record.totales.subtotalManoObra.toLocaleString('es-CL')}`, pageWidth - 20, yPos + 5, { align: 'right' });

      doc.text('Subtotal Repuestos:', startX, yPos + 15);
      doc.text(`$${record.totales.subtotalRepuestos.toLocaleString('es-CL')}`, pageWidth - 20, yPos + 15, { align: 'right' });

      doc.setDrawColor(200, 200, 200);
      doc.line(startX, yPos + 20, pageWidth - 20, yPos + 20);

      doc.setFont(undefined, 'bold');
      doc.text('VALOR NETO:', startX, yPos + 30);
      doc.text(`$${record.totales.valorNeto.toLocaleString('es-CL')}`, pageWidth - 20, yPos + 30, { align: 'right' });

      doc.setFont(undefined, 'normal');
      doc.text('IVA:', startX, yPos + 40);
      doc.text(`$${record.totales.iva.toLocaleString('es-CL')}`, pageWidth - 20, yPos + 40, { align: 'right' });

      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1);
      doc.line(startX, yPos + 45, pageWidth - 20, yPos + 45);

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(22, 163, 74);
      doc.text('TOTAL:', startX, yPos + 58);
      doc.text(`$${record.totales.total.toLocaleString('es-CL')}`, pageWidth - 20, yPos + 58, { align: 'right' });

      // Condiciones y validez
      yPos += 80;

      if (yPos < pageHeight - 60) {
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.text('CONDICIONES:', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.text('• Este presupuesto tiene una validez de 30 días desde la fecha de emisión', 25, yPos);
        yPos += 5;
        doc.text('• Los precios incluyen IVA', 25, yPos);
        yPos += 5;
        doc.text(`• Tipo de repuestos: ${record.tipoRepuesto === 'original' ? 'Originales con garantía de fábrica' : 'Alternativos con garantía limitada'}`, 25, yPos);
        yPos += 5;
        doc.text('• Sujeto a disponibilidad de repuestos', 25, yPos);
      }

      // Footer
      doc.setDrawColor(200, 200, 200);
      doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30);

      doc.setTextColor(107, 114, 128);
      doc.setFontSize(8);
      doc.setFont(undefined, 'italic');
      doc.text(`Documento generado el ${fechaGeneracion}`, 20, pageHeight - 20);
      doc.text(`Por: ${currentUser.name || currentUser.email}`, 20, pageHeight - 15);
      doc.text('Sistema MapaQuillón - Municipalidad de Quillón', pageWidth - 20, pageHeight - 20, { align: 'right' });
      doc.text('Este es un documento de presupuesto - No válido como factura', pageWidth - 20, pageHeight - 15, { align: 'right' });

      // Guardar el PDF
      const fileName = `presupuesto_${record.vehiculoPatente}_${record.fechaSolicitud || new Date().toISOString().split('T')[0]}_${Date.now()}.pdf`;
      doc.save(fileName);

      setMessage({ type: 'success', text: '✅ Presupuesto exportado correctamente como PDF' });
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      setMessage({ type: 'error', text: '❌ Error al exportar el presupuesto' });
    }
  };

  // Guardar mantenimiento
  const handleSaveMaintenance = async (e) => {
    e.preventDefault();

    if (!selectedVehicle) {
      setMessage({ type: 'error', text: '❌ Debe seleccionar un vehículo' });
      return;
    }

    if (!fechaSolicitud || !horaSolicitud) {
      setMessage({ type: 'error', text: '❌ Debe especificar fecha y hora de la solicitud' });
      return;
    }

    setLoading(true);

    try {
      const totales = calcularTotales();
      const vehiculo = vehiculos.find(v => v.id === selectedVehicle);

      const maintenanceData = {
        vehiculoId: selectedVehicle,
        vehiculoNombre: vehiculo?.nombre || '',
        vehiculoPatente: vehiculo?.patente || '',
        tipoRepuesto,
        montoIVA: parseFloat(montoIVA) || 0,
        serviciosPreventivos,
        totales,
        fechaSolicitud,
        horaSolicitud,
        fechaMantenimiento: new Date().toISOString(),
        kilometrajeActual: vehiculo?.kilometraje || 0,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString()
      };

      if (editingMaintenance) {
        const maintenanceRef = databaseRef(database, `mantenimientos/${editingMaintenance.id}`);
        await update(maintenanceRef, {
          ...maintenanceData,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid
        });

        setMessage({ type: 'success', text: '✅ Presupuesto actualizado exitosamente' });
      } else {
        const maintenanceRef = databaseRef(database, 'mantenimientos');
        const newMaintenanceRef = push(maintenanceRef);
        await databaseSet(newMaintenanceRef, maintenanceData);

        const vehicleRef = databaseRef(database, `vehiculos/${selectedVehicle}`);
        await update(vehicleRef, {
          ultimoMantenimiento: new Date().toISOString().split('T')[0],
          kilometrajeUltimoMantenimiento: vehiculo?.kilometraje || 0
        });

        setMessage({ type: 'success', text: '✅ Presupuesto registrado exitosamente' });
      }

      resetForm();

    } catch (error) {
      console.error('Error al guardar mantenimiento:', error);
      setMessage({ type: 'error', text: '❌ Error al guardar presupuesto' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditMaintenance = (maintenance) => {
    setEditingMaintenance(maintenance);
    setSelectedVehicle(maintenance.vehiculoId);
    setTipoRepuesto(maintenance.tipoRepuesto);
    setMontoIVA(maintenance.montoIVA || maintenance.totales?.iva || 0);
    setServiciosPreventivos(maintenance.serviciosPreventivos);
    setFechaSolicitud(maintenance.fechaSolicitud || new Date().toISOString().split('T')[0]);
    setHoraSolicitud(maintenance.horaSolicitud || '00:00');
    setShowMaintenanceForm(true);
    setCurrentStep(1);
  };

  const handleDeleteMaintenance = async (maintenanceId) => {
    if (window.confirm('¿Está seguro de eliminar este registro de mantenimiento?')) {
      try {
        const maintenanceRef = databaseRef(database, `mantenimientos/${maintenanceId}`);
        await remove(maintenanceRef);
        setMessage({ type: 'success', text: '✅ Presupuesto eliminado' });
      } catch (error) {
        setMessage({ type: 'error', text: '❌ Error al eliminar presupuesto' });
      }
    }
  };

  const resetForm = () => {
    setShowMaintenanceForm(false);
    setEditingMaintenance(null);
    setSelectedVehicle('');
    setTipoRepuesto('original');
    setMontoIVA(0);
    setCurrentStep(1);
    setFechaSolicitud(new Date().toISOString().split('T')[0]);
    setHoraSolicitud(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setServiciosPreventivos([]);

  };

  const totales = calcularTotales();

  // Filtrar registros con validación de datos y filtro por fechas
  const filteredRecords = maintenanceRecords.filter(record => {
    if (!record) return false;

    const vehiculoNombre = record.vehiculoNombre || '';
    const vehiculoPatente = record.vehiculoPatente || '';
    const searchTermLower = searchTerm.toLowerCase();

    const matchesSearch = searchTermLower === '' ||
      vehiculoNombre.toLowerCase().includes(searchTermLower) ||
      vehiculoPatente.toLowerCase().includes(searchTermLower);

    const matchesFilter = filterStatus === 'todos' ||
      record.tipoRepuesto === filterStatus;

    // Filtro por fechas
    let matchesDateRange = true;
    if (filterDateFrom || filterDateTo) {
      const recordDate = new Date(record.fechaSolicitud || record.fechaMantenimiento).toISOString().split('T')[0];

      if (filterDateFrom && filterDateTo) {
        matchesDateRange = recordDate >= filterDateFrom && recordDate <= filterDateTo;
      } else if (filterDateFrom) {
        matchesDateRange = recordDate >= filterDateFrom;
      } else if (filterDateTo) {
        matchesDateRange = recordDate <= filterDateTo;
      }
    }

    return matchesSearch && matchesFilter && matchesDateRange;
  });

  // Estadísticas mejoradas
  const getStats = () => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    return {
      total: maintenanceRecords.length,
      esteMes: maintenanceRecords.filter(m => new Date(m.fechaMantenimiento) >= inicioMes).length,
      costoTotal: maintenanceRecords.reduce((sum, m) => sum + (m.totales?.total || 0), 0),
      promedioMensual: Math.round(maintenanceRecords.reduce((sum, m) => sum + (m.totales?.total || 0), 0) / 12)
    };
  };

  const stats = getStats();

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header mejorado */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '30px',
        color: 'white',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.2)'
      }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '700' }}>
          ⛽ Centro de Suministros
        </h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.9, fontSize: '16px' }}>
          Registra presupuestos de servicios y consumibles de tu flota
        </p>
      </div>

      {/* Mensajes */}
      {message.text && (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '20px',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `2px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
          color: message.type === 'success' ? '#166534' : '#991b1b',
          fontWeight: '500',
          animation: 'slideIn 0.3s ease'
        }}>
          {message.text}
        </div>
      )}
      <ServiceCatalogManager
        show={showServiceCatalogManager}
        onClose={() => setShowServiceCatalogManager(false)}
        isMobile={isMobile}
        currentUser={currentUser}
      />

      {/* Dashboard de estadísticas */}
      {!showMaintenanceForm && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? '150px' : '250px'}, 1fr))`,
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              borderTop: '4px solid #3b82f6',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Total Presupuestos</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937' }}>{stats.total}</div>
                </div>
                <div style={{ fontSize: '40px', opacity: 0.2 }}>📊</div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              borderTop: '4px solid #22c55e',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Este Mes</div>
                  <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937' }}>{stats.esteMes}</div>
                </div>
                <div style={{ fontSize: '40px', opacity: 0.2 }}>📅</div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              borderTop: '4px solid #f59e0b',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Inversión Total</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                    ${stats.costoTotal.toLocaleString('es-CL')}
                  </div>
                </div>
                <div style={{ fontSize: '40px', opacity: 0.2 }}>💰</div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '25px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              borderTop: '4px solid #8b5cf6',
              transition: 'transform 0.3s ease',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Promedio Mensual</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                    ${stats.promedioMensual.toLocaleString('es-CL')}
                  </div>
                </div>
                <div style={{ fontSize: '40px', opacity: 0.2 }}>📈</div>
              </div>
            </div>
          </div>

          {/* Barra de acciones y filtros mejorada */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '16px',
            marginBottom: '30px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
          }}>
            {/* Primera fila: Botón nuevo y búsqueda */}
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
                ⛽ Centro de Suministros y Mantenimiento Preventivo
              </h1>
              <button
                onClick={() => setShowServiceCatalogManager(true)}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📦 Gestionar Catálogo
              </button>
              <button
                onClick={() => {
                  setShowMaintenanceForm(true);
                  setCurrentStep(1);
                }}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(34, 197, 94, 0.3)';
                }}>
                <span style={{ fontSize: '20px' }}>➕</span>
                Nuevo Presupuesto
              </button>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar vehículo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 15px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    width: '200px',
                    transition: 'border-color 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                />

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    padding: '10px 15px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'border-color 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}>
                  <option value="todos">Todos</option>
                  <option value="original">Originales</option>
                  <option value="alternativo">Alternativos</option>
                </select>
              </div>
            </div>

            {/* Segunda fila: Filtros de fecha */}
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                Filtrar por fecha:
              </span>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder="Desde"
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
              <span style={{ color: '#9ca3af' }}>hasta</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder="Hasta"
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
              />
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}>
                  Limpiar fechas
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Formulario mejorado con pasos */}
      {showMaintenanceForm && (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Indicador de progreso */}
          <div style={{
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            padding: '30px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                {editingMaintenance ? '✏️ Editar Presupuesto' : '➕ Nuevo Presupuesto'}
              </h2>
              <button
                onClick={resetForm}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}>
                ✖ Cancelar
              </button>
            </div>

            {/* Pasos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '600px', margin: '0 auto' }}>
              {[
                { num: 1, label: 'Vehículo', icon: '🚛' },
                { num: 2, label: 'Servicios', icon: '🔧' },
                { num: 3, label: 'Resumen', icon: '💰' }
              ].map((step, index) => (
                <div key={step.num} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1
                  }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: currentStep >= step.num ?
                        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                        '#e5e7eb',
                      color: currentStep >= step.num ? 'white' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      boxShadow: currentStep === step.num ? '0 4px 15px rgba(59, 130, 246, 0.3)' : 'none',
                      transition: 'all 0.3s ease',
                      cursor: currentStep >= step.num ? 'pointer' : 'default'
                    }}
                      onClick={() => currentStep >= step.num && setCurrentStep(step.num)}>
                      {step.icon}
                    </div>
                    <span style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: currentStep >= step.num ? '#1f2937' : '#9ca3af'
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <div style={{
                      height: '2px',
                      background: currentStep > step.num ? '#3b82f6' : '#e5e7eb',
                      flex: 1,
                      margin: '0 10px',
                      transition: 'background 0.3s ease'
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSaveMaintenance} style={{ padding: '30px' }}>
            {/* Paso 1: Selección de vehículo y fecha */}
            {currentStep === 1 && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {/* Fecha y hora de solicitud */}
                <div style={{
                  marginBottom: '30px',
                  padding: '20px',
                  background: '#f0f9ff',
                  borderRadius: '12px',
                  border: '2px solid #0ea5e9'
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#0c4a6e', fontSize: '18px' }}>
                    📅 Fecha y hora de la solicitud del presupuesto
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                        Fecha de solicitud
                      </label>
                      <input
                        type="date"
                        value={fechaSolicitud}
                        onChange={(e) => setFechaSolicitud(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                        Hora de solicitud
                      </label>
                      <input
                        type="time"
                        value={horaSolicitud}
                        onChange={(e) => setHoraSolicitud(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <h3 style={{ marginBottom: '20px', color: '#1f2937', fontSize: '20px' }}>
                  Selecciona el vehículo
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                  {vehiculos.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVehicle(v.id)}
                      style={{
                        padding: '20px',
                        border: `3px solid ${selectedVehicle === v.id ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        background: selectedVehicle === v.id ? '#eff6ff' : 'white',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedVehicle !== v.id) {
                          e.currentTarget.style.borderColor = '#93c5fd';
                          e.currentTarget.style.background = '#f0f9ff';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedVehicle !== v.id) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.background = 'white';
                        }
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#1f2937' }}>
                            {v.nombre}
                          </h4>
                          <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>
                            {v.marca} {v.modelo} • Patente: {v.patente}
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>
                            Kilometraje: {v.kilometraje?.toLocaleString('es-CL') || 0} km
                          </p>
                        </div>
                        {selectedVehicle === v.id && (
                          <div style={{ fontSize: '30px', color: '#3b82f6' }}>✓</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#1f2937', fontSize: '18px' }}>
                    Tipo de repuestos a utilizar
                  </h3>

                  <div style={{ display: 'flex', gap: '15px' }}>
                    <label style={{
                      flex: 1,
                      padding: '20px',
                      border: `3px solid ${tipoRepuesto === 'original' ? '#22c55e' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: tipoRepuesto === 'original' ? '#f0fdf4' : 'white',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}>
                      <input
                        type="radio"
                        name="tipoRepuesto"
                        value="original"
                        checked={tipoRepuesto === 'original'}
                        onChange={(e) => setTipoRepuesto(e.target.value)}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: '30px', marginBottom: '10px' }}>✅</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#15803d' }}>
                        Repuestos Originales
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                        Garantía oficial del fabricante
                      </div>
                    </label>

                    <label style={{
                      flex: 1,
                      padding: '20px',
                      border: `3px solid ${tipoRepuesto === 'alternativo' ? '#f59e0b' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: tipoRepuesto === 'alternativo' ? '#fef3c7' : 'white',
                      transition: 'all 0.3s ease',
                      textAlign: 'center'
                    }}>
                      <input
                        type="radio"
                        name="tipoRepuesto"
                        value="alternativo"
                        checked={tipoRepuesto === 'alternativo'}
                        onChange={(e) => setTipoRepuesto(e.target.value)}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: '30px', marginBottom: '10px' }}>🔄</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#92400e' }}>
                        Repuestos Alternativos
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>
                        Menor costo, garantía limitada
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    disabled={!selectedVehicle}
                    style={{
                      padding: '12px 30px',
                      background: selectedVehicle ?
                        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' :
                        '#e5e7eb',
                      color: selectedVehicle ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: selectedVehicle ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                    Continuar
                    <span style={{ fontSize: '18px' }}>→</span>
                  </button>
                </div>
              </div>
            )}

            {/* Paso 2: Servicios */}
            {currentStep === 2 && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <h3 style={{ marginBottom: '20px', color: '#1f2937', fontSize: '20px' }}>
                  Seleccionar servicios del catálogo
                </h3>

                {/* Selector de servicios del catálogo */}
                <div style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: '#f0f9ff',
                  borderRadius: '12px',
                  border: '2px solid #0ea5e9'
                }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#0c4a6e', fontSize: '16px' }}>
                    📦 Buscar en el Catálogo de Servicios
                  </h4>

                  {/* Buscador con filtros */}
                  <div style={{ marginBottom: '15px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Buscar por código o nombre del servicio..."
                      value={catalogSearchTerm}
                      onChange={(e) => setCatalogSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Lista de servicios del catálogo */}
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background: 'white'
                  }}>
                    {getFilteredCatalogServices().map(servicio => {
                      const yaAgregado = serviciosPreventivos.some(s => s.catalogoId === servicio.id);
                      const totales = calcularTotalesServicioCatalogo(servicio);

                      return (
                        <div key={servicio.id} style={{
                          padding: '12px',
                          borderBottom: '1px solid #f3f4f6',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: yaAgregado ? '#f0fdf4' : 'white',
                          transition: 'background 0.2s'
                        }}
                          onMouseEnter={(e) => !yaAgregado && (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={(e) => !yaAgregado && (e.currentTarget.style.background = 'white')}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <span style={{
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                {servicio.codigo}
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                                {servicio.descripcion}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                              Mano de obra: ${servicio.manoObra?.toLocaleString() || 0} •
                              {servicio.repuestos?.length || 0} repuesto(s) •
                              Total: ${totales.total.toLocaleString()}
                            </div>
                          </div>

                          {!yaAgregado ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                defaultValue="1"
                                id={`cantidad-${servicio.id}`}
                                style={{
                                  width: '60px',
                                  padding: '6px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => agregarServicioDeCatalogo(servicio)}
                                style={{
                                  padding: '6px 16px',
                                  background: '#22c55e',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                Agregar
                              </button>
                            </div>
                          ) : (
                            <span style={{
                              padding: '6px 12px',
                              background: '#dcfce7',
                              color: '#15803d',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '500'
                            }}>
                              ✓ Agregado
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {getFilteredCatalogServices().length === 0 && (
                      <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: '#9ca3af'
                      }}>
                        {catalogSearchTerm ?
                          'No se encontraron servicios con ese criterio' :
                          catalogoServicios.length === 0 ?
                            'No hay servicios en el catálogo. Crea servicios usando el botón "📦 Gestionar Catálogo"' :
                            'Ingresa un código o nombre para buscar'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Servicios seleccionados */}
                {serviciosPreventivos.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '15px', fontSize: '16px', color: '#374151' }}>
                      Servicios seleccionados para el presupuesto ({serviciosPreventivos.length})
                    </h4>

                    {serviciosPreventivos.map((servicio, index) => (
                      <div key={servicio.id} style={{
                        marginBottom: '15px',
                        padding: '15px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{
                                padding: '2px 8px',
                                background: '#dbeafe',
                                color: '#1e40af',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                marginRight: '10px'
                              }}>
                                {servicio.codigo}
                              </span>
                              <span style={{ fontSize: '15px', fontWeight: '500' }}>
                                {servicio.descripcion || servicio.servicio}
                              </span>
                              <span style={{
                                marginLeft: '10px',
                                padding: '2px 8px',
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                Cantidad: {servicio.cantidadServicio || servicio.cantidadRepuesto || 1}
                              </span>
                            </div>

                            {/* Detalles del servicio */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                              gap: '10px',
                              fontSize: '13px',
                              color: '#6b7280',
                              marginBottom: '10px'
                            }}>
                              <div>
                                <span style={{ color: '#9ca3af' }}>Mano de obra:</span>
                                <div style={{ fontWeight: '500' }}>
                                  ${((servicio.manoObra || 0) * (servicio.cantidadServicio || 1)).toLocaleString()}
                                </div>
                              </div>
                              {servicio.repuestos && servicio.repuestos.length > 0 && (
                                <>
                                  <div>
                                    <span style={{ color: '#9ca3af' }}>Repuestos neto:</span>
                                    <div style={{ fontWeight: '500' }}>
                                      ${servicio.totalRepuestos?.toLocaleString() || 0}
                                    </div>
                                  </div>
                                  <div>
                                    <span style={{ color: '#9ca3af' }}>IVA (19%):</span>
                                    <div style={{ fontWeight: '500' }}>
                                      ${servicio.iva?.toLocaleString() || 0}
                                    </div>
                                  </div>
                                </>
                              )}
                              <div>
                                <span style={{ color: '#9ca3af' }}>Total:</span>
                                <div style={{ fontWeight: '600', color: '#059669' }}>
                                  ${servicio.totalServicio?.toLocaleString() || 0}
                                </div>
                              </div>
                            </div>

                            {/* Lista de repuestos si existen */}
                            {servicio.repuestos && servicio.repuestos.length > 0 && (
                              <div style={{
                                padding: '8px',
                                background: 'white',
                                borderRadius: '4px',
                                fontSize: '11px',
                                color: '#6b7280'
                              }}>
                                <strong>Repuestos incluidos:</strong>
                                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                  {servicio.repuestos.map((rep, idx) => (
                                    <li key={idx}>
                                      {rep.cantidad * (servicio.cantidadServicio || 1)}x {rep.nombre} -
                                      ${(rep.costoUnitario * rep.cantidad * (servicio.cantidadServicio || 1)).toLocaleString()}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => eliminarServicio(servicio.id)}
                            style={{
                              padding: '6px 10px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Quitar
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Total general */}
                    <div style={{
                      marginTop: '20px',
                      padding: '15px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #86efac'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#059669'
                      }}>
                        <span>💰 Total del Presupuesto:</span>
                        <span>${calcularTotales().total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {serviciosPreventivos.length === 0 && (
                  <div style={{
                    padding: '40px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
                    <p style={{ fontSize: '16px', fontWeight: '500' }}>
                      No hay servicios seleccionados
                    </p>
                    <p style={{ fontSize: '14px' }}>
                      Busca y agrega servicios del catálogo para crear tu presupuesto
                    </p>
                  </div>
                )}

                {/* Navegación */}
                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    style={{
                      padding: '12px 30px',
                      background: 'white',
                      color: '#6b7280',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                    <span style={{ fontSize: '18px' }}>←</span>
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={serviciosPreventivos.length === 0}
                    style={{
                      padding: '12px 30px',
                      background: serviciosPreventivos.length > 0 ?
                        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : '#e5e7eb',
                      color: serviciosPreventivos.length > 0 ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: serviciosPreventivos.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                    Continuar
                    <span style={{ fontSize: '18px' }}>→</span>
                  </button>
                </div>
              </div>
            )}
            {/* Paso 3: Resumen */}
            {currentStep === 3 && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <h3 style={{ marginBottom: '20px', color: '#1f2937', fontSize: '20px' }}>
                  Resumen del presupuesto
                </h3>

                {/* Información de la solicitud */}
                <div style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: '#fef3c7',
                  borderRadius: '12px',
                  border: '2px solid #fbbf24'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#78350f', fontSize: '16px' }}>
                    📅 Información de la Solicitud
                  </h4>
                  <p style={{ margin: '5px 0', fontSize: '15px', color: '#92400e' }}>
                    <strong>Fecha:</strong> {new Date(fechaSolicitud).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '15px', color: '#92400e' }}>
                    <strong>Hora:</strong> {horaSolicitud} hrs
                  </p>
                </div>

                {/* Información del vehículo */}
                <div style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: '#f0f9ff',
                  borderRadius: '12px',
                  border: '2px solid #0284c7'
                }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0c4a6e', fontSize: '16px' }}>
                    🚛 Vehículo
                  </h4>
                  {vehiculos.filter(v => v.id === selectedVehicle).map(v => (
                    <div key={v.id}>
                      <p style={{ margin: '5px 0', fontSize: '15px', color: '#334155' }}>
                        <strong>{v.nombre}</strong> - {v.marca} {v.modelo}
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '14px', color: '#64748b' }}>
                        Patente: {v.patente} | Kilometraje: {v.kilometraje?.toLocaleString('es-CL') || 0} km
                      </p>
                    </div>
                  ))}
                </div>

                {/* Resumen de servicios */}
                <div style={{
                  marginBottom: '20px',
                  padding: '20px',
                  background: '#f3f4f6',
                  borderRadius: '12px',
                  border: '2px solid #9ca3af'
                }}>
                  <h4 style={{ margin: '0 0 15px 0', color: '#374151', fontSize: '16px' }}>
                    🔧 Servicios presupuestados
                  </h4>
                  {serviciosPreventivos.map((s, i) => (
                    <div key={s.id} style={{
                      padding: '10px',
                      marginBottom: '10px',
                      background: 'white',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '14px' }}>
                          #{i + 1} {s.descripcion || s.servicio || 'Sin nombre'}
                        </strong>
                        <span style={{ fontWeight: '600', color: '#059669' }}>
                          ${(s.totalServicio || ((parseFloat(s.manoObra) || 0) + ((parseFloat(s.costoRepuesto) || 0) * (parseInt(s.cantidadRepuesto) || 1)))).toLocaleString('es-CL')}
                        </span>
                      </div>
                      {s.detalle && (
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                          {s.detalle}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Resumen de costos */}
                <div style={{
                  padding: '25px',
                  background: tipoRepuesto === 'original' ? '#f0fdf4' : '#fef3c7',
                  borderRadius: '12px',
                  border: `3px solid ${tipoRepuesto === 'original' ? '#22c55e' : '#f59e0b'}`
                }}>
                  <h4 style={{
                    margin: '0 0 20px 0',
                    color: tipoRepuesto === 'original' ? '#166534' : '#78350f',
                    fontSize: '18px',
                    textAlign: 'center'
                  }}>
                    💰 Presupuesto con repuestos {tipoRepuesto === 'original' ? 'ORIGINALES' : 'ALTERNATIVOS'}
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                    <div style={{ fontSize: '15px', color: '#6b7280' }}>Subtotal Mano de Obra:</div>
                    <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: '500' }}>
                      ${totales.subtotalManoObra.toLocaleString('es-CL')}
                    </div>

                    <div style={{ fontSize: '15px', color: '#6b7280' }}>Subtotal Repuestos:</div>
                    <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: '500' }}>
                      ${totales.subtotalRepuestos.toLocaleString('es-CL')}
                    </div>

                    <div style={{
                      paddingTop: '10px',
                      borderTop: '1px solid #e5e7eb',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      VALOR NETO:
                    </div>
                    <div style={{
                      paddingTop: '10px',
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '16px'
                    }}>
                      ${totales.valorNeto.toLocaleString('es-CL')}
                    </div>

                    <div style={{ fontSize: '15px', color: '#6b7280' }}>IVA:</div>
                    <div style={{ textAlign: 'right', fontSize: '15px' }}>
                      ${totales.iva.toLocaleString('es-CL')}
                    </div>

                    <div style={{
                      paddingTop: '15px',
                      borderTop: '2px solid',
                      borderColor: tipoRepuesto === 'original' ? '#22c55e' : '#f59e0b',
                      fontSize: '22px',
                      fontWeight: 'bold',
                      color: tipoRepuesto === 'original' ? '#166534' : '#78350f'
                    }}>
                      TOTAL:
                    </div>
                    <div style={{
                      paddingTop: '15px',
                      borderTop: '2px solid',
                      borderColor: tipoRepuesto === 'original' ? '#22c55e' : '#f59e0b',
                      textAlign: 'right',
                      fontSize: '22px',
                      fontWeight: 'bold',
                      color: tipoRepuesto === 'original' ? '#166534' : '#78350f'
                    }}>
                      ${totales.total.toLocaleString('es-CL')}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    style={{
                      padding: '12px 30px',
                      background: 'white',
                      color: '#6b7280',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                    <span style={{ fontSize: '18px' }}>←</span>
                    Anterior
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '12px 40px',
                      background: loading ? '#9ca3af' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
                    }}>
                    {loading ? '⏳ Guardando...' : editingMaintenance ? '✅ Actualizar Presupuesto' : '✅ Guardar Presupuesto'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideIn {
              from { transform: translateX(-20px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Lista de mantenimientos mejorada */}
      {!showMaintenanceForm && (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '25px',
            borderBottom: '2px solid #e5e7eb',
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
          }}>
            <h2 style={{ margin: 0, color: '#1f2937', fontSize: '22px', fontWeight: '600' }}>
              📋 Historial de Presupuestos
            </h2>
          </div>

          {filteredRecords.length === 0 ? (
            <div style={{
              padding: '60px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '60px', marginBottom: '20px', opacity: 0.2 }}>🔧</div>
              <h3 style={{ color: '#9ca3af', fontSize: '20px', margin: '0 0 10px 0' }}>
                No hay presupuestos registrados
              </h3>
              <p style={{ color: '#d1d5db', fontSize: '16px' }}>
                {(filterDateFrom || filterDateTo) ? 'No se encontraron presupuestos en el rango de fechas seleccionado' : 'Comienza agregando tu primer presupuesto de mantenimiento'}
              </p>
              {(filterDateFrom || filterDateTo) && (
                <button
                  onClick={() => {
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}>
                  Ver todos los presupuestos
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {filteredRecords.map((record) => (
                <div key={record.id} style={{
                  marginBottom: '15px',
                  padding: '20px',
                  background: '#f9fafb',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.transform = 'translateX(5px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1f2937' }}>
                          {record.vehiculoNombre}
                        </h3>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: record.tipoRepuesto === 'original' ? '#dcfce7' : '#fef3c7',
                          color: record.tipoRepuesto === 'original' ? '#166534' : '#78350f'
                        }}>
                          {record.tipoRepuesto === 'original' ? '✅ Original' : '🔄 Alternativo'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#6b7280', flexWrap: 'wrap' }}>
                        <span>📅 Solicitud: {record.fechaSolicitud || new Date(record.fechaMantenimiento).toLocaleDateString('es-CL')}</span>
                        <span>🕐 {record.horaSolicitud || 'Sin hora'}</span>
                        <span>🚗 {record.vehiculoPatente}</span>
                        <span>🔧 {record.serviciosPreventivos?.length || 0} servicios</span>
                        <span>📍 {record.kilometrajeActual?.toLocaleString('es-CL') || 0} km</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>Total</div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#059669' }}>
                          ${record.totales?.total?.toLocaleString('es-CL') || 0}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleExportPDF(record)}
                          style={{
                            padding: '8px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            transition: 'background 0.3s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                          title="Exportar a PDF">
                          📄
                        </button>
                        <button
                          onClick={() => handleEditMaintenance(record)}
                          style={{
                            padding: '8px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px'
                          }}
                          title="Editar">
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteMaintenance(record.id)}
                          style={{
                            padding: '8px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px'
                          }}
                          title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreventiveMaintenanceModule;