# Anugerah Store - Sistem POS Kasir Ritel (PWA Offline-First)

Sistem Kasir Ritel Desktop-First & Progressive Web Application (PWA) modern, ringan, bebas biaya operasional bulanan (permanen free tier), dan dirancang khusus ramah pengguna lansia (*elderly-friendly UX*).

---

## 🌟 Fitur Utama

1. **Layar Kasir Tunggal (Single-Screen POS):**
   - Keranjang belanja di sebelah kanan, scanner & katalog di sebelah kiri. Tidak ada menu tersembunyi.
   - Ukuran tombol besar ($\ge$ 52px) dengan kontras tinggi dan font terbaca jelas untuk kasir senior.
   - Hotkey cepat: `F2` untuk fokus scanner barcode, `F9` untuk langsung bayar.

2. **Dukungan Barcode Fleksibel:**
   - **Scanner Fisik USB / Bluetooth (HID Emulator):** Otomatis mendeteksi pemindaian tanpa perlu klik mouse atau tombol layar.
   - **Kamera Handphone / Laptop (PWA Barcode Detection):** Scan barcode langsung dari browser saat stok opname di lorong rak toko.
   - **Umpan Balik Suara (Web Audio API):** Nada *beep* tinggi (880 Hz) saat barang masuk, buzzer rendah (220 Hz) saat barcode tidak terdaftar, dan *chime* lonceng kasir saat pembayaran selesai.

3. **Pembayaran Manual Tanpa Biaya Gateway (0% Fee):**
   - **Tunai:** Tombol pecahan uang cepat (Uang Pas, 10rb, 20rb, 50rb, 100rb, 200rb) dan kalkulator kembalian otomatis raksasa.
   - **QRIS Statis:** Panduan scan stiker QRIS resmi di meja kasir.
   - **Transfer Bank:** Panduan transfer rekening BCA & BRI.
   - **Rekonsiliasi Kasir:** Memisahkan saldo fisik di laci kasir vs saldo e-wallet / mutasi bank.

4. **Katalog & Pengendali Stok (HPP & Laba Kotor):**
   - Menghitung laba kotor dan margin keuntungan (%) otomatis per produk.
   - Indikator status stok: **Aman** (Hijau), **Menipis** (Kuning), dan **Habis** (Merah).
   - Ekspor data produk ke CSV.

5. **Kulakan & Biaya Operasional:**
   - Pencatatan kulakan restok (otomatis menambah stok produk terkait).
   - Pencatatan beban utilitas (Token listrik PLN, kantong kresek, operasional, dll).

6. **Stok Opname Rak Toko:**
   - Hitung stok riil di rak fisik dan bandingkan dengan catatan komputer kasir.
   - Selisih otomatis dihitung (*Cocok*, *Kurang/Hilang*, *Lebih*).
   - Sekali klik untuk menyelaraskan stok sistem.

7. **Laporan Keuangan & Insight:**
   - Omset Penjualan, Modal (HPP), Laba Kotor (*Gross Profit*), Beban Pengeluaran, dan Laba Bersih (*Net Profit*).
   - Analisis Produk Terlaris (*Top Selling Items*).
   - Deteksi Barang Mati (*Dead-Stock*).
   - Cetak struk kasir thermal standar (58mm / 80mm).

---

## 🎨 Palet Warna & Desain (Bitepoint Aesthetic)

- **Canvas / Background:** `#F9F6EE` (Krem Hangat)
- **Kartu & Permukaan:** `#FFFFFF` (Putih Bersih) dengan sudut lengkung besar `rounded-3xl` dan bayangan lembut
- **Aksen Utama (CTA):** `#F7CA58` (Golden Amber / Mustard)
- **Aksen Sekunder (Hero Card & Logo):** `#084C46` (Deep Forest Green)
- **Teks Utama:** `#1A202C` & `#4A5568`
- **Garis Pembatas:** `#EDE8D5` / `#F0ECE1`

---

## 🚀 Infrastruktur Gratis Permanen (Free Tier)

| Layanan | Free Tier Kuota | Proyeksi Penggunaan Anugerah Store |
| :--- | :--- | :--- |
| **Cloudflare Pages** | Bandwidth & Request Unlimited | Hosting statis PWA tanpa batas waktu, zero cold-sleep. |
| **Turso (libSQL SQLite)** | **9 GB Storage**, 1 Miliar Reads/bln, 25 Juta Writes/bln | Mampu menampung 150 transaksi/hari selama lebih dari **100 tahun**. |
| **Dexie.js (IndexedDB)** | Berjalan di storage lokal browser kasir | 100% offline-first. Toko tetap buka walau internet mati total. |

---

## 🛠️ Cara Menjalankan Secara Lokal

```bash
# 1. Pastikan Node.js 18+ telah terpasang
node -v

# 2. Pasang dependensi
npm install

# 3. Jalankan server pengembang lokal
npm run dev
```

Buka peramban di `http://localhost:5173`.

---

## ☁️ Panduan Deploy ke Cloudflare Pages

1. Buat repositori di GitHub dan push proyek ini:
   ```bash
   git init
   git add .
   git commit -m "feat: inisialisasi sistem pos anugerah store"
   git branch -M main
   git remote add origin <url-repo-anda>
   git push -u origin main
   ```
2. Buka dasbor **Cloudflare** $\rightarrow$ **Workers & Pages** $\rightarrow$ **Create Application** $\rightarrow$ **Pages** $\rightarrow$ **Connect to Git**.
3. Atur konfigurasi build:
   - **Framework Preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Klik **Save and Deploy**. Web aplikasi kasir Anda langsung aktif dengan domain gratis `*.pages.dev` dan SSL otomatis!
