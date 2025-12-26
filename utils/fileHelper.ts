import * as XLSX from 'xlsx';
import { Expense } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converte un ArrayBuffer in base64
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Converte una stringa di testo in un'immagine base64 (PNG).
 * Usato per passare dati testuali (CSV) all'AI che accetta immagini.
 */
const textToImage = (text: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      const lines = text.split('\n');
      const fontSize = 14;
      const lineHeight = 18;
      const padding = 20;
      const fontFamily = 'Courier New, monospace'; // Monospace per allineamento migliore

      // Calcola dimensioni
      ctx.font = `${fontSize}px ${fontFamily}`;
      let maxWidth = 0;
      lines.forEach(line => {
        const width = ctx.measureText(line).width;
        if (width > maxWidth) maxWidth = width;
      });

      // Limiti dimensioni per evitare canvas giganti
      const finalWidth = Math.min(Math.max(maxWidth + padding * 2, 600), 2000);
      // Tagliamo se troppe righe per evitare errori AI o memory, 
      // ma Gemini gestisce bene immagini alte. Limitiamo a ~300 righe per sicurezza performance
      const maxLines = 300; 
      const renderLines = lines.slice(0, maxLines);
      const finalHeight = renderLines.length * lineHeight + padding * 2;

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Sfondo bianco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Testo nero
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      renderLines.forEach((line, index) => {
        ctx.fillText(line, padding, padding + index * lineHeight);
      });

      if (lines.length > maxLines) {
          ctx.fillStyle = '#666666';
          ctx.fillText(`... e altre ${lines.length - maxLines} righe ...`, padding, padding + maxLines * lineHeight);
      }

      // Export
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    } catch (error) {
      reject(error);
    }
  });
};

export const processFileToImage = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  let textContent = '';

  if (file.name.endsWith('.csv')) {
    textContent = await file.text();
  } else if (file.name.match(/\.(xlsx|xls)$/i)) {
    // Leggi Excel usando SheetJS
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Converti in CSV per semplicità di rappresentazione testuale
    textContent = XLSX.utils.sheet_to_csv(sheet);
  } else {
    // Se è già un'immagine, la processiamo standard
    if (file.type.startsWith('image/')) {
        return processImageFile(file);
    }
    throw new Error('Formato file non supportato. Usa CSV, Excel o Immagini.');
  }

  // Se il contenuto è vuoto
  if (!textContent.trim()) {
    throw new Error('Il file sembra vuoto.');
  }

  // Converti il testo CSV in un'immagine "screenshot"
  const base64Image = await textToImage(textContent);
  
  return {
    base64: base64Image,
    mimeType: 'image/png',
  };
};

export const processImageFile = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const MAX = 1024; 
            if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
            else if (height >= width && height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(ctx) { 
                ctx.drawImage(img, 0, 0, width, height);
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve({ base64: canvas.toDataURL(mime, 0.8).split(',')[1], mimeType: mime });
            } else reject(new Error('Canvas error'));
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = url;
    });
};

export const pickImage = (source: 'camera' | 'gallery'): Promise<File> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if(source === 'camera') input.capture = 'environment';
        input.onchange = (e: any) => {
            if(e.target.files && e.target.files[0]) resolve(e.target.files[0]);
            else reject(new Error('Nessun file'));
        };
        input.click();
    });
};

/**
 * Esporta le spese in formato Excel o JSON
 * MOBILE: Usa Capacitor Filesystem + Share
 * WEB: Usa Blob download tradizionale
 * @returns Promise con { success: boolean, message: string }
 */
export const exportExpenses = async (expenses: Expense[], format: 'excel' | 'json' = 'excel'): Promise<{ success: boolean; message: string }> => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const isNative = Capacitor.isNativePlatform();

    if (format === 'excel') {
        try {
            const rows = expenses.map(e => ({
                Data: e.date,
                Ora: e.time || '',
                Importo: e.amount,
                Descrizione: e.description,
                Categoria: e.category,
                Sottocategoria: e.subcategory || '',
                Conto: e.accountId,
                Tags: e.tags ? e.tags.join(', ') : '',
                Frequenza: e.frequency === 'recurring' ? 'Ricorrente' : 'Singola'
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Spese");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const fileName = `Spese_Export_${dateStr}.xlsx`;

            if (isNative) {
                // MOBILE: Salva in cache + condividi
                const base64Data = arrayBufferToBase64(excelBuffer);
                
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Cache
                });

                await Share.share({
                    title: 'Esporta Spese Excel',
                    text: `File Excel delle spese del ${dateStr}`,
                    url: result.uri,
                    dialogTitle: 'Salva o Condividi Excel'
                });

                return { success: true, message: `Excel pronto per il salvataggio` };
            } else {
                // WEB: Blob download
                const blob = new Blob([excelBuffer], { 
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                return { success: true, message: `File Excel scaricato: ${fileName}` };
            }
        } catch (e) {
            console.error("Export Excel failed", e);
            return { 
                success: false, 
                message: `Errore export Excel: ${e instanceof Error ? e.message : 'Errore sconosciuto'}` 
            };
        }
    } else if (format === 'json') {
        try {
            const jsonStr = JSON.stringify(expenses, null, 2);
            const fileName = `Spese_Export_${dateStr}.json`;

            if (isNative) {
                // MOBILE: Salva + condividi
                const result = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonStr,
                    directory: Directory.Cache,
                    encoding: 'utf8' as any
                });

                await Share.share({
                    title: 'Esporta Spese JSON',
                    text: `File JSON delle spese del ${dateStr}`,
                    url: result.uri,
                    dialogTitle: 'Salva o Condividi JSON'
                });

                return { success: true, message: `JSON pronto per il salvataggio` };
            } else {
                // WEB: Blob download
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                return { success: true, message: `File JSON scaricato: ${fileName}` };
            }
        } catch (e) {
            console.error("Export JSON failed", e);
            return { 
                success: false, 
                message: `Errore export JSON: ${e instanceof Error ? e.message : 'Errore sconosciuto'}` 
            };
        }
    }
    
    return { success: false, message: 'Formato non supportato.' };
};
