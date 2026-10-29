/**
 * Format angka ke format Rupiah standar Indonesia: "Rp 25.000"
 */
export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

/**
 * Format angka ribuan standar Indonesia: "1.250"
 */
export function formatNumber(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0';
  return Math.round(amount).toLocaleString('id-ID');
}

/**
 * Format jumlah/kuantitas barang (mendukung pecahan eceran desimal):
 * Contoh: 1 -> "1", 0.5 -> "0,5", 0.25 -> "0,25", 0.75 -> "0,75", 1.5 -> "1,5"
 */
export function formatQty(qty: number): string {
  if (isNaN(qty) || qty === null || qty === undefined) return '0';
  if (Number.isInteger(qty)) return qty.toString();
  // Untuk angka desimal, batasi hingga 3 angka di belakang koma dan hapus trailing zero
  const trimmed = parseFloat(qty.toFixed(3));
  return trimmed.toString().replace('.', ',');
}

/**
 * Format tanggal lengkap Bahasa Indonesia: "Rabu, 20 Oktober 2026, 16:30"
 */
export function formatDateIndo(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format tanggal ringkas: "20 Okt 2026"
 */
export function formatShortDate(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format jam menit: "16:30 WIB"
 */
export function formatTime(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' WIB';
  } catch {
    return '';
  }
}

/**
 * Buat nomor nota resmi Anugerah Store: NOTA-AS-YYYYMMDD-XXXX
 */
export function generateReceiptNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `NOTA-AS-${year}${month}${day}-${randomSuffix}`;
}

/**
 * ID generator sederhana tanpa dependensi eksternal
 */
export function generateId(prefix = 'as'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
