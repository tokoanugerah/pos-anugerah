/**
 * Utilitas kompresi gambar produk untuk penyimpanan lokal Dexie & offline-first
 * Mengubah file foto menjadi string Data URL JPEG yang ringan (~20-45 KB)
 */
export async function compressProductImage(file: File, maxDimension = 480, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung skala rasio agar tidak melebihi maxDimension
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi canvas untuk kompresi gambar'));
          return;
        }

        // Fill background putih untuk gambar PNG transparan
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Ekspor ke format JPEG dengan kualitas terkompresi
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = (e) => reject(e);
      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}
