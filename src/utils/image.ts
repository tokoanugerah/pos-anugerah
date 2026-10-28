/**
 * Utilitas kompresi gambar produk untuk penyimpanan lokal Dexie & offline-first
 * Mengubah file foto menjadi string Data URL JPEG yang ringan (~20-45 KB)
 */
export async function compressProductImage(file: File | Blob, maxDimension = 480, quality = 0.8): Promise<string> {
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

/**
 * Mengunduh gambar dari URL web publik (menggunakan wsrv.nl proxy untuk bypass CORS)
 * lalu mengompresnya menjadi Base64 Data URL JPEG (~25-45 KB)
 */
export async function fetchAndCompressImageUrl(imageUrl: string, maxDimension = 480, quality = 0.8): Promise<string> {
  const cleanUrl = imageUrl.trim();
  if (!cleanUrl) throw new Error('URL gambar kosong.');

  // Deteksi jika pengguna menempel link halaman web belanja (bukan tautan file foto)
  const isHtmlPage =
    cleanUrl.includes('/shop/') ||
    cleanUrl.includes('/product/') ||
    cleanUrl.includes('/item/') ||
    cleanUrl.includes('/p/') ||
    cleanUrl.endsWith('.html') ||
    cleanUrl.endsWith('.htm') ||
    cleanUrl.endsWith('.php');

  const hasImageExtension = Boolean(cleanUrl.match(/\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i));

  if (isHtmlPage && !hasImageExtension) {
    throw new Error(
      'Tautan yang Anda tempel adalah link halaman toko/website, bukan file foto. Silakan klik kanan foto produk di website tersebut, pilih "Salin Alamat Gambar" (Copy image address) atau pilih "Salin Gambar" (Copy image) lalu tekan Ctrl+V.'
    );
  }

  let blob: Blob | null = null;
  const proxiedUrl = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&w=${maxDimension}&output=jpg`;

  try {
    const res = await fetch(proxiedUrl);
    if (res.ok) {
      blob = await res.blob();
    }
  } catch (e) {
    console.warn('Proxy wsrv.nl gagal, mencoba unduh langsung:', e);
  }

  if (!blob) {
    try {
      const resDirect = await fetch(cleanUrl);
      if (resDirect.ok) {
        blob = await resDirect.blob();
      }
    } catch (e) {
      console.warn('Unduh langsung gagal:', e);
    }
  }

  if (!blob) {
    throw new Error(
      'Tidak dapat mengunduh gambar dari tautan tersebut. Pastikan link file gambar dapat diakses publik, atau gunakan fitur klik kanan foto lalu "Salin Gambar" (Copy image) dan tekan Ctrl+V di sini.'
    );
  }

  return compressProductImage(blob, maxDimension, quality);
}
