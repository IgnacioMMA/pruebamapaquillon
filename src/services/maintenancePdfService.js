// src/services/maintenancePdfService.js

import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const maintenancePdfService = {
  exportMaintenanceHistory: (vehicle, history, currentUser) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Historial de Mantenimiento', 20, 20);
    
    // Información del vehículo
    doc.setFontSize(12);
    doc.text(`Vehículo: ${vehicle.nombre}`, 20, 35);
    doc.text(`Marca/Modelo: ${vehicle.marca} ${vehicle.modelo}`, 20, 42);
    doc.text(`Patente: ${vehicle.patente}`, 20, 49);
    doc.text(`Kilometraje Actual: ${vehicle.kilometraje?.toLocaleString() || 0} km`, 20, 56);
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.text(`Generado por: ${currentUser.name || currentUser.email}`, 20, 70);
    doc.text(`Fecha: ${new Date().toLocaleString('es-CL')}`, 20, 76);
    
    // Tabla de mantenimientos
    const tableData = history.map(m => {
      const trabajos = [];
      if (m.cambioAceite) trabajos.push('Aceite');
      if (m.filtroAire) trabajos.push('F.Aire');
      if (m.filtroAceite) trabajos.push('F.Aceite');
      if (m.revisionFrenos) trabajos.push('Frenos');
      if (m.revisionNeumaticos) trabajos.push('Neumáticos');
      
      return [
        new Date(m.fecha).toLocaleDateString('es-CL'),
        m.tipoMantenimiento,
        m.kilometraje || '-',
        m.realizadoPor,
        trabajos.join(', ') || '-',
        m.costoMantenimiento ? `$${m.costoMantenimiento.toLocaleString()}` : '-'
      ];
    });
    
    doc.autoTable({
      startY: 85,
      head: [['Fecha', 'Tipo', 'Km', 'Responsable', 'Trabajos', 'Costo']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [31, 41, 55] },
      styles: { fontSize: 9 }
    });
    
    // Resumen de inspecciones
    let yPosition = doc.lastAutoTable.finalY + 15;
    
    if (history.length > 0) {
      const lastMaintenance = history[0];
      
      doc.setFontSize(14);
      doc.text('Última Inspección de Seguridad', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      const inspections = [
        { label: 'Gata', value: lastMaintenance.gata },
        { label: 'Chaleco Reflectante', value: lastMaintenance.chalecoReflectante },
        { label: 'Llave Repuesto', value: lastMaintenance.llaveRepuesto },
        { label: 'Cinturón', value: lastMaintenance.cinturon },
        { label: 'Parabrisas', value: lastMaintenance.parabrisas },
        { label: 'Luces Freno', value: lastMaintenance.lucesFreno },
        { label: 'Luces Delanteras', value: lastMaintenance.lucesDelanteras }
      ];
      
      inspections.forEach(insp => {
        if (insp.value && insp.value !== 'no_aplica') {
          const status = insp.value === 'bueno' ? '✓' : 
                        insp.value === 'requiere_atencion' ? '!' : 'X';
          doc.text(`${insp.label}: ${status}`, 25, yPosition);
          yPosition += 6;
        }
      });
    }
    
    // Próximo mantenimiento
    if (vehicle.proximoMantenimiento) {
      yPosition += 10;
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38); // Rojo
      doc.text('PRÓXIMO MANTENIMIENTO:', 20, yPosition);
      doc.setTextColor(0, 0, 0);
      doc.text(
        new Date(vehicle.proximoMantenimiento).toLocaleDateString('es-CL'), 
        85, 
        yPosition
      );
      if (vehicle.kilometrajeProximoMantenimiento) {
        doc.text(
          `o ${vehicle.kilometrajeProximoMantenimiento.toLocaleString()} km`,
          120,
          yPosition
        );
      }
    }
    
    // Guardar PDF
    doc.save(`mantenimiento_${vehicle.patente}_${Date.now()}.pdf`);
  },
  
  exportMaintenanceReport: (maintenance, vehicle) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Reporte de Mantenimiento', 20, 20);
    
    // Detalles del mantenimiento
    doc.setFontSize(11);
    let y = 35;
    
    doc.text(`Fecha: ${new Date(maintenance.fecha).toLocaleDateString('es-CL')}`, 20, y);
    y += 7;
    doc.text(`Vehículo: ${vehicle.nombre} - ${vehicle.patente}`, 20, y);
    y += 7;
    doc.text(`Tipo: ${maintenance.tipoMantenimiento}`, 20, y);
    y += 7;
    doc.text(`Kilometraje: ${maintenance.kilometraje || vehicle.kilometraje} km`, 20, y);
    y += 7;
    doc.text(`Realizado por: ${maintenance.realizadoPor}`, 20, y);
    y += 7;
    if (maintenance.tallerResponsable) {
      doc.text(`Taller: ${maintenance.tallerResponsable}`, 20, y);
      y += 7;
    }
    
    // Trabajos realizados
    y += 10;
    doc.setFontSize(14);
    doc.text('Trabajos Realizados:', 20, y);
    y += 8;
    
    doc.setFontSize(10);
    const trabajos = [
      { key: 'cambioAceite', label: 'Cambio de Aceite' },
      { key: 'filtroAire', label: 'Filtro de Aire' },
      { key: 'filtroAceite', label: 'Filtro de Aceite' },
      { key: 'filtroCombustible', label: 'Filtro de Combustible' },
      { key: 'revisionFrenos', label: 'Revisión de Frenos' },
      { key: 'revisionNeumaticos', label: 'Revisión de Neumáticos' },
      { key: 'revisionSuspension', label: 'Revisión de Suspensión' },
      { key: 'revisionDireccion', label: 'Revisión de Dirección' },
      { key: 'revisionBateria', label: 'Revisión de Batería' },
      { key: 'revisionLuces', label: 'Revisión de Luces' },
      { key: 'nivelLiquidos', label: 'Nivel de Líquidos' }
    ];
    
    trabajos.forEach(trabajo => {
      if (maintenance[trabajo.key]) {
        doc.text(`✓ ${trabajo.label}`, 25, y);
        y += 6;
      }
    });
    
    // Inspección de seguridad
    y += 10;
    doc.setFontSize(14);
    doc.text('Inspección de Seguridad:', 20, y);
    y += 8;
    
    doc.setFontSize(10);
    const inspecciones = [
      { key: 'gata', label: 'Gata', value: maintenance.gata, obs: maintenance.gataObservaciones },
      { key: 'chalecoReflectante', label: 'Chaleco Reflectante', value: maintenance.chalecoReflectante, obs: maintenance.chalecoObservaciones },
      { key: 'llaveRepuesto', label: 'Llave de Repuesto', value: maintenance.llaveRepuesto, obs: maintenance.llaveObservaciones },
      { key: 'cinturon', label: 'Cinturón de Seguridad', value: maintenance.cinturon, obs: maintenance.cinturonObservaciones },
      { key: 'parabrisas', label: 'Parabrisas', value: maintenance.parabrisas, obs: maintenance.parabrisasObservaciones },
      { key: 'lucesFreno', label: 'Luces de Freno', value: maintenance.lucesFreno, obs: maintenance.lucesObservaciones },
      { key: 'lucesDelanteras', label: 'Luces Delanteras', value: maintenance.lucesDelanteras, obs: maintenance.lucesDObservaciones }
    ];
    
    inspecciones.forEach(insp => {
      if (insp.value && insp.value !== 'no_aplica') {
        const estado = insp.value === 'bueno' ? 'BUENO' :
                      insp.value === 'requiere_atencion' ? 'REQUIERE ATENCIÓN' : 'MALO';
        doc.text(`${insp.label}: ${estado}`, 25, y);
        if (insp.obs) {
          y += 5;
          doc.setFontSize(9);
          doc.text(`  Observación: ${insp.obs}`, 30, y);
          doc.setFontSize(10);
        }
        y += 6;
      }
    });
    
    // Observaciones generales
    if (maintenance.observacionesGenerales) {
      y += 10;
      doc.setFontSize(14);
      doc.text('Observaciones:', 20, y);
      y += 8;
      doc.setFontSize(10);
      
      const lines = doc.splitTextToSize(maintenance.observacionesGenerales, 170);
      lines.forEach(line => {
        doc.text(line, 20, y);
        y += 6;
      });
    }
    
    // Costo
    if (maintenance.costoMantenimiento > 0) {
      y += 10;
      doc.setFontSize(12);
      doc.text(`Costo Total: $${maintenance.costoMantenimiento.toLocaleString()}`, 20, y);
    }
    
    // Próximo mantenimiento
    if (maintenance.proximoMantenimientoFecha || maintenance.proximoMantenimientoKm) {
      y += 10;
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text('PRÓXIMO MANTENIMIENTO:', 20, y);
      doc.setTextColor(0, 0, 0);
      y += 7;
      doc.setFontSize(10);
      if (maintenance.proximoMantenimientoFecha) {
        doc.text(`Fecha: ${new Date(maintenance.proximoMantenimientoFecha).toLocaleDateString('es-CL')}`, 25, y);
        y += 6;
      }
      if (maintenance.proximoMantenimientoKm) {
        doc.text(`Kilometraje: ${maintenance.proximoMantenimientoKm.toLocaleString()} km`, 25, y);
      }
    }
    
    // Footer
    doc.setFontSize(8);
    doc.text(`Generado el ${new Date().toLocaleString('es-CL')}`, 20, 280);
    
    // Guardar
    doc.save(`reporte_mantenimiento_${vehicle.patente}_${Date.now()}.pdf`);
  }
};