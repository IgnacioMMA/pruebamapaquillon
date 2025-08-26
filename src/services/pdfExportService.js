// src/services/pdfExportService.js
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ========== CONFIGURACIÓN DE ESTILOS ==========
const COLORS = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1f2937',
  gray: '#6b7280'
};

const FONTS = {
  title: 20,
  subtitle: 16,
  heading: 14,
  normal: 11,
  small: 9
};

// ========== SERVICIO DE EXPORTACIÓN PDF ==========
export const pdfExportService = {

  // ========== EXPORTAR USUARIO INDIVIDUAL A PDF (CON RUT Y LICENCIA) ==========
  exportSingleUserToPDF: (user, currentUser) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // VALIDACIÓN DE DATOS
    if (!user) {
      console.error('Error: No se recibió usuario para exportar');
      return;
    }

    console.log('Exportando usuario:', user);

    // Fecha y hora actual
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // ========== HEADER CON GRADIENTE ==========
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 50, 'F');

    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('SISTEMA MAPAQUILLON', pageWidth / 2, 25, { align: 'center' });

    doc.setFontSize(16);
    doc.setFont(undefined, 'normal');
    doc.text('Ficha de Usuario', pageWidth / 2, 38, { align: 'center' });

    // ========== FOTO/AVATAR PLACEHOLDER ==========
    doc.setFillColor(240, 242, 245);
    doc.circle(pageWidth / 2, 75, 20, 'F');

    // Inicial del usuario
    doc.setTextColor(102, 126, 234);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    const inicial = (user.name || user.email || 'U').charAt(0).toUpperCase();
    doc.text(inicial, pageWidth / 2, 82, { align: 'center' });

    // ========== NOMBRE DEL USUARIO ==========
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    const nombreMostrar = user.name || user.email || 'Usuario sin nombre';
    doc.text(nombreMostrar, pageWidth / 2, 105, { align: 'center' });

    // Rol con badge
    const roleColors = {
      'superadmin': [109, 33, 168],
      'admin': [30, 64, 175],
      'trabajador': [22, 163, 74],
      'junta_vecinos': [217, 119, 6]
    };

    const roleNames = {
      'superadmin': 'SUPER ADMINISTRADOR',
      'admin': 'ADMINISTRADOR',
      'trabajador': 'TRABAJADOR',
      'junta_vecinos': 'JUNTA DE VECINOS'
    };

    const roleColor = roleColors[user.role] || [107, 114, 128];
    const roleName = roleNames[user.role] || user.role?.toUpperCase() || 'ROL NO DEFINIDO';

    // Badge del rol
    doc.setFillColor(...roleColor);
    const badgeWidth = roleName.length * 5 + 20;
    doc.roundedRect(pageWidth / 2 - badgeWidth / 2, 110, badgeWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(roleName, pageWidth / 2, 117, { align: 'center' });

    // ========== INFORMACIÓN DETALLADA ==========
    let yPos = 140;

    // Título de sección
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('INFORMACION PERSONAL', 20, yPos);

    // Línea decorativa
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);

    yPos += 15;

    // Función helper para agregar campo
    const addField = (label, value, yPosition) => {
      // Label
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(label, 30, yPosition);

      // Value
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      const displayValue = value || 'No especificado';
      doc.text(displayValue, 30, yPosition + 6);

      return yPosition + 18;
    };

    // Campos de información personal
    yPos = addField('RUT:', user.rut || 'No especificado', yPos);
    yPos = addField('Correo Electronico:', user.email || 'No especificado', yPos);
    yPos = addField('Telefono:', user.phone || 'No especificado', yPos);

    // NUEVO: Licencia de conducir con detalles
    if (user.licenciaConducir) {
      const licenciaTexto = {
        'B': 'Clase B - Vehiculos particulares',
        'C': 'Clase C - Vehiculos de dos ruedas',
        'A1': 'Clase A1 - Taxis',
        'A2': 'Clase A2 - Buses y taxibuses',
        'A3': 'Clase A3 - Transporte de carga simple',
        'A4': 'Clase A4 - Transporte con remolque',
        'A5': 'Clase A5 - Todo tipo de vehiculos',
        'D': 'Clase D - Maquinaria automotriz',
        'E': 'Clase E - Vehiculos de traccion animal',
        'F': 'Clase F - Vehiculos especiales'
      }[user.licenciaConducir] || `Clase ${user.licenciaConducir}`;

      yPos = addField('Licencia de Conducir:', licenciaTexto, yPos);
    } else {
      yPos = addField('Licencia de Conducir:', 'Sin licencia registrada', yPos);
    }

    yPos = addField('Localidad/Sector:', user.localidad || 'No especificado', yPos);

    // Estado de la cuenta
    const estadoCuenta = user.active === false ? 'INACTIVA' : 'ACTIVA';
    yPos = addField('Estado de la Cuenta:', estadoCuenta, yPos);

    // Fecha de registro
    if (user.createdAt) {
      try {
        const fechaRegistro = new Date(user.createdAt).toLocaleDateString('es-CL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        yPos = addField('Fecha de Registro:', fechaRegistro, yPos);
      } catch (e) {
        yPos = addField('Fecha de Registro:', 'No disponible', yPos);
      }
    }

    // ID del usuario
    yPos = addField('ID de Usuario:', user.id || user.uid || 'No disponible', yPos);

    // ========== INFORMACIÓN ADICIONAL ==========
    yPos += 10;
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('PERMISOS Y CAPACIDADES', 20, yPos);

    doc.setDrawColor(229, 231, 235);
    doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);

    yPos += 15;

    // Permisos según el rol
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Permisos del Usuario:', 30, yPos);

    yPos += 8;

    const permisos = {
      'superadmin': [
        '- Acceso total al sistema',
        '- Gestion de usuarios',
        '- Gestion de vehiculos',
        '- Configuracion del sistema',
        '- Acceso a todos los modulos'
      ],
      'admin': [
        '- Dashboard GPS',
        '- Gestion de zonas',
        '- Monitoreo de flota',
        '- Asignacion de trabajos',
        '- NO puede crear usuarios'
      ],
      'trabajador': [
        '- Sistema GPS personal',
        '- Recepcion de zonas asignadas',
        '- Registro de recorridos',
        '- Dashboard personal',
        '- NO puede asignar trabajos'
      ],
      'junta_vecinos': [
        '- Crear solicitudes',
        '- Ver estado de solicitudes',
        '- Comunicacion con municipio',
        '- Acceso limitado a su localidad'
      ]
    };

    const userPermisos = permisos[user.role] || ['- Sin permisos definidos'];

    doc.setFontSize(9);
    userPermisos.forEach(permiso => {
      if (yPos < pageHeight - 60) {
        doc.text(permiso, 35, yPos);
        yPos += 6;
      }
    });

    // NUEVO: Sección de vehículos autorizados según licencia
    if (user.licenciaConducir && yPos < pageHeight - 80) {
      yPos += 10;
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text('Vehiculos Autorizados a Conducir:', 30, yPos);

      yPos += 8;
      doc.setFontSize(9);

      const vehiculosAutorizados = {
        'B': ['Automoviles', 'Camionetas hasta 3.500 kg'],
        'C': ['Motocicletas', 'Motonetas', 'Vehiculos de 3 ruedas'],
        'A1': ['Taxis', 'Vehiculos de alquiler'],
        'A2': ['Buses', 'Minibuses', 'Taxibuses'],
        'A3': ['Camiones simples', 'Vehiculos de carga'],
        'A4': ['Camiones con remolque', 'Vehiculos articulados'],
        'A5': ['Todo tipo de vehiculos motorizados'],
        'D': ['Maquinaria pesada', 'Retroexcavadoras', 'Gruas'],
        'E': ['Carretones', 'Vehiculos de traccion animal'],
        'F': ['Vehiculos adaptados', 'Vehiculos especiales']
      };

      const vehiculos = vehiculosAutorizados[user.licenciaConducir] || ['Segun licencia clase ' + user.licenciaConducir];
      vehiculos.forEach(vehiculo => {
        if (yPos < pageHeight - 60) {
          doc.text('- ' + vehiculo, 35, yPos);
          yPos += 6;
        }
      });
    }

    // ========== CÓDIGO QR SIMULADO ==========
    if (yPos < pageHeight - 80) {
      yPos += 10;
      doc.setFillColor(240, 242, 245);
      doc.rect(pageWidth / 2 - 30, yPos, 60, 40, 'F');

      // Texto dentro del recuadro
      doc.setTextColor(31, 41, 55);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('CODIGO ID', pageWidth / 2, yPos + 10, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const shortId = (user.id || user.uid || 'NO-ID').substring(0, 8).toUpperCase();
      doc.text(shortId, pageWidth / 2, yPos + 25, { align: 'center' });

      // RUT si existe
      if (user.rut) {
        doc.setFontSize(8);
        doc.text('RUT: ' + user.rut, pageWidth / 2, yPos + 35, { align: 'center' });
      }
    }

    // ========== PIE DE PÁGINA ==========
    doc.setDrawColor(229, 231, 235);
    doc.line(20, pageHeight - 35, pageWidth - 20, pageHeight - 35);

    doc.setTextColor(107, 114, 128);
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text(`Generado el ${fecha} a las ${hora}`, 20, pageHeight - 25);
    doc.text(`Por: ${currentUser.name || currentUser.email}`, 20, pageHeight - 18);
    doc.text('Sistema MapaQuillon - Municipalidad de Quillon', pageWidth - 20, pageHeight - 18, { align: 'right' });

    // Guardar el PDF con el nombre del usuario
    const fileName = `usuario_${(user.name || user.email || 'sin_nombre').replace(/[^\w]/g, '_')}_${now.getTime()}.pdf`;
    doc.save(fileName);
  },

  // ========== EXPORTAR USUARIOS A PDF (CON RUT Y LICENCIA) ==========
  exportUsersToPDF: (users, currentUser) => {
    const doc = new jsPDF('landscape'); // Orientación horizontal para más columnas
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margins = { top: 20, left: 15, right: 15, bottom: 20 };

    // Fecha y hora actual
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // ========== HEADER ==========
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Título principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(FONTS.title);
    doc.setFont(undefined, 'bold');
    doc.text('SISTEMA MAPAQUILLÓN', pageWidth / 2, 20, { align: 'center' });

    // Subtítulo
    doc.setFontSize(FONTS.subtitle);
    doc.setFont(undefined, 'normal');
    doc.text('Reporte de Usuarios', pageWidth / 2, 30, { align: 'center' });

    // ========== INFORMACIÓN DEL REPORTE ==========
    doc.setTextColor(COLORS.dark);
    doc.setFontSize(FONTS.small);
    doc.setFont(undefined, 'normal');

    // Cuadro de información
    doc.setFillColor(245, 247, 250);
    doc.rect(margins.left, 50, pageWidth - margins.left - margins.right, 25, 'F');

    doc.text(`Fecha de generación: ${fecha}`, margins.left + 5, 60);
    doc.text(`Hora: ${hora}`, margins.left + 5, 67);
    doc.text(`Generado por: ${currentUser.name || currentUser.email}`, pageWidth / 2, 60);
    doc.text(`Total de usuarios: ${users.length}`, pageWidth / 2, 67);

    // ========== ESTADÍSTICAS DE USUARIOS ==========
    const stats = {
      superadmins: users.filter(u => u.role === 'superadmin').length,
      admins: users.filter(u => u.role === 'admin').length,
      trabajadores: users.filter(u => u.role === 'trabajador').length,
      juntasVecinos: users.filter(u => u.role === 'junta_vecinos').length,
      activos: users.filter(u => u.active !== false).length,
      inactivos: users.filter(u => u.active === false).length,
      conLicencia: users.filter(u => u.licenciaConducir).length,
      sinLicencia: users.filter(u => !u.licenciaConducir).length
    };

    // Cuadro de estadísticas
    let yPosition = 85;
    doc.setFontSize(FONTS.heading);
    doc.setFont(undefined, 'bold');
    doc.text('Estadísticas de Usuarios', margins.left, yPosition);

    yPosition += 10;
    doc.setFontSize(FONTS.normal);
    doc.setFont(undefined, 'normal');

    // Crear grid de estadísticas
    const statsData = [
      ['Super Admins', stats.superadmins.toString(), 'Administradores', stats.admins.toString()],
      ['Trabajadores', stats.trabajadores.toString(), 'Juntas de Vecinos', stats.juntasVecinos.toString()],
      ['Usuarios Activos', stats.activos.toString(), 'Usuarios Inactivos', stats.inactivos.toString()],
      ['Con Licencia', stats.conLicencia.toString(), 'Sin Licencia', stats.sinLicencia.toString()]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: statsData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 242, 245] },
        2: { fontStyle: 'bold', fillColor: [240, 242, 245] }
      }
    });

    // ========== TABLA DE USUARIOS ==========
    yPosition = doc.lastAutoTable.finalY + 15;

    doc.setFontSize(FONTS.heading);
    doc.setFont(undefined, 'bold');
    doc.text('Lista Detallada de Usuarios', margins.left, yPosition);

    // Preparar datos para la tabla con nuevas columnas
    const tableHeaders = [
      ['#', 'Nombre', 'RUT', 'Email', 'Rol', 'Licencia', 'Teléfono', 'Localidad', 'Estado']
    ];

    const tableData = users.map((user, index) => {
      const rol = {
        'superadmin': 'Super Admin',
        'admin': 'Administrador',
        'trabajador': 'Trabajador',
        'junta_vecinos': 'Junta Vecinos'
      }[user.role] || user.role || 'Sin rol';

      const licencia = user.licenciaConducir ? `Clase ${user.licenciaConducir}` : 'No';

      return [
        (index + 1).toString(),
        user.name || 'Sin nombre',
        user.rut || '-',
        user.email || '',
        rol,
        licencia,
        user.phone || '-',
        user.localidad || '-',
        user.active === false ? 'Inactivo' : 'Activo'
      ];
    });

    autoTable(doc, {
      startY: yPosition + 7,
      head: tableHeaders,
      body: tableData,
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
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 28 },
        3: { cellWidth: 45 },
        4: { cellWidth: 30 },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 25 },
        7: { cellWidth: 35 },
        8: { cellWidth: 20, halign: 'center' }
      },
      didDrawPage: function (data) {
        // Footer en cada página
        doc.setFontSize(FONTS.small);
        doc.setTextColor(COLORS.gray);
        doc.text(
          `Página ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    // ========== RESUMEN DE LICENCIAS ==========
    const finalY = doc.lastAutoTable.finalY;
    if (finalY < pageHeight - 60) {
      doc.addPage();
      let summaryY = 30;

      doc.setFontSize(FONTS.heading);
      doc.setFont(undefined, 'bold');
      doc.text('Resumen de Licencias de Conducir', margins.left, summaryY);

      summaryY += 10;

      // Contar licencias por tipo
      const licenciaCount = {};
      users.forEach(user => {
        if (user.licenciaConducir) {
          licenciaCount[user.licenciaConducir] = (licenciaCount[user.licenciaConducir] || 0) + 1;
        }
      });

      const licenciaData = Object.entries(licenciaCount).map(([tipo, cantidad]) => {
        const descripcion = {
          'B': 'Vehículos particulares',
          'C': 'Vehículos de dos ruedas',
          'A1': 'Taxis',
          'A2': 'Buses y taxibuses',
          'A3': 'Transporte de carga simple',
          'A4': 'Transporte con remolque',
          'A5': 'Todo tipo de vehículos',
          'D': 'Maquinaria automotriz',
          'E': 'Vehículos de tracción animal',
          'F': 'Vehículos especiales'
        }[tipo] || 'Otros';

        return [`Clase ${tipo}`, descripcion, cantidad.toString()];
      });

      if (licenciaData.length > 0) {
        autoTable(doc, {
          startY: summaryY,
          head: [['Clase', 'Descripción', 'Cantidad']],
          body: licenciaData,
          theme: 'grid',
          headStyles: {
            fillColor: [102, 126, 234],
            textColor: 255,
            fontSize: 10,
            fontStyle: 'bold'
          },
          bodyStyles: {
            fontSize: 9
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 100 },
            2: { cellWidth: 30, halign: 'center' }
          }
        });
      }
    }

    // ========== PIE DE PÁGINA FINAL ==========
    const lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : finalY;
    if (lastY < pageHeight - 40) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margins.left, lastY + 10, pageWidth - margins.right, lastY + 10);

      doc.setFontSize(FONTS.small);
      doc.setTextColor(COLORS.gray);
      doc.setFont(undefined, 'italic');
      doc.text(
        'Este documento fue generado automáticamente por el Sistema MapaQuillón',
        pageWidth / 2,
        lastY + 20,
        { align: 'center' }
      );
      doc.text(
        '© 2024 Municipalidad de Quillón - Todos los derechos reservados',
        pageWidth / 2,
        lastY + 27,
        { align: 'center' }
      );
    }

    // Guardar el PDF
    doc.save(`usuarios_mapaquillon_${now.getTime()}.pdf`);
  },

  // ========== EXPORTAR VEHÍCULOS A PDF ==========
  exportVehiclesToPDF: (vehiculos, tiposVehiculo, currentUser) => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margins = { top: 20, left: 15, right: 15, bottom: 20 };

    // Fecha y hora actual
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const hora = now.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // ========== HEADER ==========
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(FONTS.title);
    doc.setFont(undefined, 'bold');
    doc.text('SISTEMA MAPAQUILLÓN', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(FONTS.subtitle);
    doc.setFont(undefined, 'normal');
    doc.text('Reporte de Flota Vehicular', pageWidth / 2, 30, { align: 'center' });

    // ========== INFORMACIÓN DEL REPORTE ==========
    doc.setTextColor(COLORS.dark);
    doc.setFontSize(FONTS.small);
    doc.setFont(undefined, 'normal');

    doc.setFillColor(245, 247, 250);
    doc.rect(margins.left, 50, pageWidth - margins.left - margins.right, 25, 'F');

    doc.text(`Fecha: ${fecha}`, margins.left + 5, 60);
    doc.text(`Hora: ${hora}`, margins.left + 5, 67);
    doc.text(`Generado por: ${currentUser.name || currentUser.email}`, pageWidth / 2, 60);
    doc.text(`Total de vehículos: ${vehiculos.length}`, pageWidth / 2, 67);

    // ========== ESTADÍSTICAS DE VEHÍCULOS ==========
    const vehicleStats = {
      disponibles: vehiculos.filter(v => v.estado === 'disponible').length,
      enUso: vehiculos.filter(v => v.estado === 'en_uso').length,
      mantenimiento: vehiculos.filter(v => v.estado === 'mantenimiento').length,
      fueraServicio: vehiculos.filter(v => v.estado === 'fuera_servicio').length
    };

    let yPosition = 85;
    doc.setFontSize(FONTS.heading);
    doc.setFont(undefined, 'bold');
    doc.text('Estado de la Flota', margins.left, yPosition);

    yPosition += 10;

    const vehicleStatsData = [
      ['Disponibles', vehicleStats.disponibles.toString(), 'En Uso', vehicleStats.enUso.toString()],
      ['En Mantenimiento', vehicleStats.mantenimiento.toString(), 'Fuera de Servicio', vehicleStats.fueraServicio.toString()]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: vehicleStatsData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [240, 242, 245] },
        2: { fontStyle: 'bold', fillColor: [240, 242, 245] }
      }
    });

    // ========== LISTA DE VEHÍCULOS ==========
    yPosition = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(FONTS.heading);
    doc.setFont(undefined, 'bold');
    doc.text('Inventario de Vehículos', margins.left, yPosition);

    // Preparar datos para la tabla
    const tableHeaders = [
      ['#', 'Nombre', 'Tipo', 'Marca', 'Modelo', 'Año', 'Patente', 'Kilometraje', 'Estado', 'Documentos']
    ];

    const tableData = vehiculos.map((vehiculo, index) => {
      const tipo = tiposVehiculo?.find(t => t.id === vehiculo.tipo);
      const tipoDisplay = tipo ? tipo.nombre : vehiculo.tipo || 'Sin tipo';

      const estadoDisplay = {
        'disponible': 'Disponible',
        'en_uso': 'En Uso',
        'mantenimiento': 'Mantenimiento',
        'fuera_servicio': 'Fuera Servicio'
      }[vehiculo.estado] || vehiculo.estado || 'Desconocido';

      // Contar documentos cargados
      let docsCount = 0;
      if (vehiculo.documentos) {
        Object.keys(vehiculo.documentos).forEach(key => {
          if (key === 'otros' && Array.isArray(vehiculo.documentos[key])) {
            docsCount += vehiculo.documentos[key].length;
          } else if (vehiculo.documentos[key]?.url) {
            docsCount++;
          }
        });
      }

      return [
        (index + 1).toString(),
        vehiculo.nombre || 'Sin nombre',
        tipoDisplay,
        vehiculo.marca || '-',
        vehiculo.modelo || '-',
        vehiculo.año?.toString() || '-',
        vehiculo.patente || '-',
        vehiculo.kilometraje ? `${vehiculo.kilometraje.toLocaleString()} km` : '-',
        estadoDisplay,
        docsCount > 0 ? `${docsCount} docs` : 'Sin docs'
      ];
    });

    autoTable(doc, {
      startY: yPosition + 7,
      head: tableHeaders,
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 25 },
        7: { cellWidth: 28, halign: 'right' },
        8: { cellWidth: 25 },
        9: { cellWidth: 20, halign: 'center' }
      },
      didDrawPage: function (data) {
        // Footer en cada página
        doc.setFontSize(FONTS.small);
        doc.setTextColor(COLORS.gray);
        doc.text(
          `Página ${data.pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    // Guardar el PDF
    doc.save(`vehiculos_mapaquillon_${now.getTime()}.pdf`);

    
  },
  // NUEVA FUNCIÓN - Agregar aquí, DENTRO del objeto
  exportMaintenanceHistory: (vehicle, history, currentUser) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // Fecha y hora actual
    const now = new Date();
    const fecha = now.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Header
    doc.setFillColor(34, 197, 94);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('HISTORIAL DE MANTENIMIENTO', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`${vehicle.nombre} - ${vehicle.patente}`, pageWidth / 2, 32, { align: 'center' });
    
    // Información del vehículo
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    let yPos = 55;
    
    doc.text(`Marca/Modelo: ${vehicle.marca} ${vehicle.modelo}`, 20, yPos);
    yPos += 8;
    doc.text(`Año: ${vehicle.año || '-'}`, 20, yPos);
    yPos += 8;
    doc.text(`Kilometraje Actual: ${vehicle.kilometraje?.toLocaleString() || 0} km`, 20, yPos);
    yPos += 8;
    doc.text(`Total de Mantenimientos: ${history.length}`, 20, yPos);
    
    // Línea divisora
    yPos += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 10;
    
    // Tabla de mantenimientos
    const tableData = history.map(m => {
      const trabajos = [];
      if (m.cambioAceite) trabajos.push('Aceite');
      if (m.filtroAire) trabajos.push('F.Aire');
      if (m.filtroAceite) trabajos.push('F.Aceite');
      if (m.revisionFrenos) trabajos.push('Frenos');
      if (m.revisionNeumaticos) trabajos.push('Neumáticos');
      
      const fecha = new Date(m.fecha).toLocaleDateString('es-CL');
      const tipo = m.tipoMantenimiento || 'General';
      const km = m.kilometraje || '-';
      const responsable = m.realizadoPor || '-';
      const costo = m.costoMantenimiento ? `$${m.costoMantenimiento.toLocaleString()}` : '-';
      
      return [fecha, tipo, km, responsable, trabajos.join(', ') || '-', costo];
    });
    
    if (tableData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Tipo', 'Km', 'Responsable', 'Trabajos', 'Costo']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [34, 197, 94],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 40 },
          4: { cellWidth: 55 },
          5: { cellWidth: 25 }
        }
      });
      
      yPos = doc.lastAutoTable.finalY + 15;
    }
    
    // Última inspección de seguridad
    if (history.length > 0 && yPos < pageHeight - 60) {
      const lastMaintenance = history[0];
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Última Inspección de Seguridad', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
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
        if (insp.value && insp.value !== 'no_aplica' && yPos < pageHeight - 30) {
          const status = insp.value === 'bueno' ? '✓ Bueno' : 
                        insp.value === 'requiere_atencion' ? '⚠ Requiere Atención' : 
                        '✗ Malo';
          doc.text(`${insp.label}: ${status}`, 25, yPos);
          yPos += 6;
        }
      });
    }
    
    // Próximo mantenimiento
    if (vehicle.proximoMantenimiento && yPos < pageHeight - 40) {
      yPos += 10;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text('PRÓXIMO MANTENIMIENTO:', 20, yPos);
      doc.setTextColor(0, 0, 0);
      doc.text(new Date(vehicle.proximoMantenimiento).toLocaleDateString('es-CL'), 85, yPos);
      
      if (vehicle.kilometrajeProximoMantenimiento) {
        doc.text(`o ${vehicle.kilometrajeProximoMantenimiento.toLocaleString()} km`, 120, yPos);
      }
    }
    
    // Footer
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado el ${fecha} por ${currentUser.name || currentUser.email}`, 20, pageHeight - 20);
    doc.text('Sistema MapaQuillón', pageWidth - 20, pageHeight - 20, { align: 'right' });
    
    // Guardar PDF
    doc.save(`mantenimiento_${vehicle.patente}_${Date.now()}.pdf`);
  }
  
};
  


export default pdfExportService;