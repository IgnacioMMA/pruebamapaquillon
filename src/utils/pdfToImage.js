// src/utils/pdfToImage.js
import * as pdfjsLib from 'pdfjs-dist';

// ⚠️ CONFIGURACIÓN CORRECTA DEL WORKER
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const convertPdfToImage = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const imageFile = new File(
          [blob], 
          file.name.replace('.pdf', '.jpg'),
          { type: 'image/jpeg' }
        );
        resolve(imageFile);
      }, 'image/jpeg', 0.95);
    });
    
  } catch (error) {
    console.error('Error convirtiendo PDF:', error);
    throw error;
  }
};