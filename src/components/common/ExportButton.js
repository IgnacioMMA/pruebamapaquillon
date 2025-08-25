import React, { useState } from 'react';

const ExportButton = ({ 
  onExport, 
  label = 'Exportar a PDF',
  icon = '📄',
  style = {},
  disabled = false 
}) => {
  const [exporting, setExporting] = useState(false);
  
  const handleClick = async () => {
    setExporting(true);
    try {
      await onExport();
    } catch (error) {
      console.error('Error al exportar:', error);
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      disabled={disabled || exporting}
      style={{
        padding: '10px 20px',
        background: exporting ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled || exporting ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.3s ease',
        ...style
      }}
    >
      {exporting ? (
        <>
          <span style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid white',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></span>
          Generando PDF...
        </>
      ) : (
        <>
          {icon} {label}
        </>
      )}
    </button>
  );
};

export default ExportButton;