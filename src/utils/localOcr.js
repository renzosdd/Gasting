import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

const MAX_PDF_PAGES = 4;

const canvasFromImageFile = async (file) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const ocrCanvas = async (canvas, onProgress) => {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(canvas, 'spa+eng', {
    logger: (message) => {
      if (message.status === 'recognizing text') {
        onProgress?.(`OCR ${(message.progress * 100).toFixed(0)}%`);
      }
    },
  });
  return result.data.text || '';
};

const extractTextFromImage = async (file, onProgress) => {
  onProgress?.('Preparando imagen...');
  const canvas = await canvasFromImageFile(file);
  return ocrCanvas(canvas, onProgress);
};

const extractTextFromPdf = async (file, onProgress) => {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const chunks = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress?.(`Leyendo página ${pageNumber}/${pageCount}...`);
    const page = await pdf.getPage(pageNumber);

    const textContent = await page.getTextContent();
    const textLayer = textContent.items.map(item => item.str).join(' ').trim();
    if (textLayer.length > 80) {
      chunks.push(textLayer);
      continue;
    }

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    chunks.push(await ocrCanvas(canvas, onProgress));
  }

  return chunks.join('\n\n').trim();
};

export const extractTextFromDocument = async (file, onProgress) => {
  if (file.type === 'application/pdf') {
    return extractTextFromPdf(file, onProgress);
  }

  if (file.type.startsWith('image/')) {
    return extractTextFromImage(file, onProgress);
  }

  throw new Error('Formato no soportado. Usá PDF o imagen.');
};
