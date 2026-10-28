import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Sparkles,
  ExternalLink,
  ClipboardPaste,
  Check,
  Loader2,
  Globe,
  LayoutGrid,
} from 'lucide-react';
import { fetchAndCompressImageUrl, compressProductImage } from '../utils/image';
import { playSuccessBeep, playErrorBeep, playKeyClick } from '../utils/sound';

interface ImageSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  original: string;
  source: string;
}

// Koleksi preset foto sembako & komoditas ritel Indonesia berkualitas tinggi
const PRESET_GROCERY_PHOTOS = [
  {
    category: 'Sembako',
    title: 'Gula Pasir Kuning / Gulaku',
    url: 'https://images.unsplash.com/photo-1622484212850-eb596d769edc?w=400&q=80',
  },
  {
    category: 'Sembako',
    title: 'Gula Pasir Putih Kristal',
    url: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=400&q=80',
  },
  {
    category: 'Sembako',
    title: 'Minyak Goreng Botol',
    url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80',
  },
  {
    category: 'Sembako',
    title: 'Beras Putih Pulen',
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
  },
  {
    category: 'Sembako',
    title: 'Telur Ayam Segar',
    url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400&q=80',
  },
  {
    category: 'Sembako',
    title: 'Tepung Terigu Segitiga',
    url: 'https://images.unsplash.com/photo-1627485937980-221c88ac04f9?w=400&q=80',
  },
  {
    category: 'Minuman',
    title: 'Air Mineral Botol',
    url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&q=80',
  },
  {
    category: 'Minuman',
    title: 'Kopi Bubuk Hitam',
    url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80',
  },
  {
    category: 'Minuman',
    title: 'Teh Seduh',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
  },
  {
    category: 'Minuman',
    title: 'Susu UHT Kemasan',
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80',
  },
  {
    category: 'Makanan',
    title: 'Mie Instan Goreng',
    url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80',
  },
  {
    category: 'Makanan',
    title: 'Biskuit & Snack',
    url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=80',
  },
  {
    category: 'Makanan',
    title: 'Roti Tawar',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
  },
  {
    category: 'Bumbu',
    title: 'Kecap & Bumbu Dapur',
    url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80',
  },
  {
    category: 'Kebersihan',
    title: 'Sabun Cuci Piring',
    url: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=400&q=80',
  },
];

interface AutoImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  onSelectImage: (base64DataUrl: string) => void;
}

export const AutoImageSearchModal: React.FC<AutoImageSearchModalProps> = ({
  isOpen,
  onClose,
  productName,
  onSelectImage,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'google' | 'preset'>('search');
  const [query, setQuery] = useState(productName || '');
  const [pastedUrl, setPastedUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const prevOpenRef = useRef(false);

  // Search online from multiple reliable public endpoints
  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    setErrorMsg(null);
    setResults([]);

    const found: ImageSearchResult[] = [];

    try {
      // 1. Coba Open Food Facts via allorigins proxy / direct
      try {
        const targetUrl = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=8`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.hits)) {
            data.hits.forEach((item: { code?: string; product_name?: string; image_front_url?: string; image_url?: string }, idx: number) => {
              const img = item.image_front_url || item.image_url;
              if (img && item.product_name) {
                found.push({
                  id: `off_${item.code || idx}`,
                  title: item.product_name,
                  thumbnail: img,
                  original: img,
                  source: 'Open Food Facts',
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Gagal mencari di Open Food Facts:', err);
      }

      // 2. Coba openfoodfacts.net brand search jika hasil masih sedikit
      if (found.length < 3) {
        try {
          const firstWord = q.split(' ')[0].toLowerCase();
          const v2Url = `https://world.openfoodfacts.net/api/v2/search?brands_tags=${encodeURIComponent(firstWord)}&fields=product_name,image_front_url,image_url&page_size=6`;
          const resV2 = await fetch(v2Url);
          if (resV2.ok) {
            const dataV2 = await resV2.json();
            if (Array.isArray(dataV2.products)) {
              dataV2.products.forEach((p: { product_name?: string; image_front_url?: string; image_url?: string }, idx: number) => {
                const img = p.image_front_url || p.image_url;
                if (img && p.product_name && !found.some((x) => x.thumbnail === img)) {
                  found.push({
                    id: `off_v2_${idx}`,
                    title: p.product_name,
                    thumbnail: img,
                    original: img,
                    source: 'Katalog FMCG',
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn('Gagal query openfoodfacts.net:', err);
        }
      }

      // 3. Coba Wikimedia Commons jika masih belum ada
      if (found.length < 2) {
        try {
          const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
          const resWiki = await fetch(wikiUrl);
          if (resWiki.ok) {
            const dataWiki = await resWiki.json();
            if (dataWiki.query?.pages) {
              const pages = Object.values(dataWiki.query.pages) as Array<{
                title: string;
                imageinfo?: Array<{ thumburl?: string; url?: string }>;
              }>;
              pages.forEach((p, idx) => {
                const img = p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url;
                if (img && !found.some((x) => x.thumbnail === img)) {
                  found.push({
                    id: `wiki_${idx}`,
                    title: p.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
                    thumbnail: img,
                    original: img,
                    source: 'Wikimedia',
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn('Gagal query Wikimedia:', err);
        }
      }

      setResults(found);
      if (found.length === 0) {
        setErrorMsg('Tidak menemukan gambar otomatis untuk kata kunci ini. Anda bisa menggunakan tab "Google Images" atau pilih dari "Koleksi Sembako".');
      }
    } catch (err) {
      console.error('Error saat pencarian online:', err);
      setErrorMsg('Gagal terhubung ke layanan pencarian. Silakan gunakan Google Images atau upload langsung.');
    } finally {
      setIsSearching(false);
    }
  };

  // Sync initial query when opened
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const initial = productName.trim();
      const timer = setTimeout(() => {
        setQuery(initial);
        setPastedUrl('');
        setErrorMsg(null);
        if (initial) {
          handleSearch(initial);
        }
      }, 10);
      prevOpenRef.current = isOpen;
      return () => clearTimeout(timer);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, productName]);

  // Handle global paste (Ctrl+V) anywhere inside the modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            try {
              setIsDownloading(true);
              const compressed = await compressProductImage(file);
              playSuccessBeep();
              onSelectImage(compressed);
              onClose();
            } catch (err) {
              console.error('Gagal memproses gambar dari clipboard:', err);
              playErrorBeep();
              setErrorMsg('Gagal memproses gambar yang disalin dari clipboard.');
            } finally {
              setIsDownloading(false);
            }
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onSelectImage, onClose]);

  // Download & apply selected image
  const handleApplyImage = async (url: string) => {
    try {
      setIsDownloading(true);
      setErrorMsg(null);
      playKeyClick();
      const compressedDataUrl = await fetchAndCompressImageUrl(url);
      playSuccessBeep();
      onSelectImage(compressedDataUrl);
      onClose();
    } catch (err: unknown) {
      console.error('Gagal mengunduh gambar:', err);
      playErrorBeep();
      const msg = err instanceof Error ? err.message : 'Gagal mengunduh atau mengompres gambar ini.';
      setErrorMsg(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  // Tempel langsung dari clipboard sistem jika didukung
  const handleClipboardRead = async () => {
    try {
      if (!navigator.clipboard?.read) {
        setErrorMsg('Silakan gunakan tombol keyboard Ctrl + V untuk menempelkan gambar yang sudah Anda salin.');
        return;
      }
      setIsDownloading(true);
      setErrorMsg(null);
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const compressed = await compressProductImage(blob);
          playSuccessBeep();
          onSelectImage(compressed);
          onClose();
          return;
        }
      }
      // Jika teks clipboard berupa URL
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith('http')) {
        await handleApplyImage(text.trim());
        return;
      }
      setErrorMsg('Tidak ada gambar di clipboard. Klik kanan gambar di web lalu pilih "Salin Gambar" (Copy Image).');
    } catch (err) {
      console.warn('Gagal membaca clipboard:', err);
      setErrorMsg('Izin clipboard tidak tersedia. Cukup klik area ini lalu tekan Ctrl + V pada keyboard.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Open Google Images Search in new tab
  const handleOpenGoogleImages = () => {
    playKeyClick();
    const searchTarget = query.trim() || productName.trim() || 'Produk Sembako';
    const googleUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTarget)}`;
    window.open(googleUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-dark/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-card w-full max-w-2xl rounded-3xl p-6 sm:p-7 shadow-modal border-2 border-cream-300 relative my-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cream-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber/30 text-forest flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-forest" />
            </div>
            <div>
              <h3 className="text-lg font-black text-ink">Cari Foto Produk Otomatis</h3>
              <p className="text-xs text-ink-muted">Pilih atau cari foto barang dagangan secara instan</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-cream-100 hover:bg-cream-200 text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1.5 bg-cream-100 rounded-2xl border border-cream-200">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'search'
                ? 'bg-forest text-amber shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Cari Online</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'google'
                ? 'bg-forest text-amber shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Google Images</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preset')}
            className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'preset'
                ? 'bg-forest text-amber shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Koleksi Sembako</span>
          </button>
        </div>

        {/* TAB 1: CARI ONLINE OTOMATIS */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Search Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(query);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-forest absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ketik nama produk (cth: Indomie Goreng, Bimoli, Bango)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-cream-50 border border-cream-300 rounded-xl font-bold text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-4 py-2.5 bg-amber hover:bg-amber-hover text-forest font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Cari</span>
              </button>
            </form>

            {/* Loading state */}
            {isSearching && (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-forest" />
                <p className="text-xs font-bold text-ink">Mencari kemasan produk dari katalog ritel...</p>
              </div>
            )}

            {/* Error or Empty Feedback */}
            {errorMsg && !isSearching && (
              <div className="p-3 bg-status-warningBg border border-status-warningText/30 text-status-warningText text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            {/* Image Results Grid */}
            {!isSearching && results.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-ink-muted">
                  Ditemukan {results.length} opsi gambar. Klik salah satu foto untuk memilih:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {results.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => !isDownloading && handleApplyImage(res.original)}
                      className="group p-2.5 bg-cream-50 hover:bg-cream-100 rounded-2xl border-2 border-cream-300 hover:border-forest/50 cursor-pointer transition-all flex flex-col justify-between"
                    >
                      <div className="w-full h-28 rounded-xl bg-white overflow-hidden border border-cream-200 flex items-center justify-center mb-2">
                        <img
                          src={res.thumbnail}
                          alt={res.title}
                          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink line-clamp-2 leading-tight">
                          {res.title}
                        </p>
                        <span className="text-[10px] text-ink-muted mt-1 block">
                          Sumber: {res.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GOOGLE IMAGES & SALIN TEMPEL */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            <div className="p-4 bg-cream-50 rounded-2xl border border-cream-300 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-sm text-ink">Cari Bebas di Google Images</h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Buka pencarian gambar Google untuk menemukan foto kemasan resmi atau merek toko
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenGoogleImages}
                  className="px-4 py-2.5 bg-forest hover:bg-forest-light text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4 text-amber" />
                  <span>Buka Google Images</span>
                </button>
              </div>

              {/* Paste URL Box */}
              <div className="pt-2 border-t border-cream-200 space-y-2">
                <label className="text-xs font-bold text-ink-muted block">
                  Tempel / Paste URL File Gambar (.jpg, .png, .webp):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={pastedUrl}
                    onChange={(e) => setPastedUrl(e.target.value)}
                    placeholder="https://contoh.com/gambar-produk.jpg"
                    className="flex-1 px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-forest"
                  />
                  <button
                    type="button"
                    disabled={!pastedUrl.trim() || isDownloading}
                    onClick={() => handleApplyImage(pastedUrl.trim())}
                    className="px-4 py-2 bg-amber hover:bg-amber-hover text-forest font-bold rounded-xl text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Pasang Foto</span>
                  </button>
                </div>
                <p className="text-[11px] text-ink-muted">
                  *Catatan: Pastikan tautan yang ditempel adalah file foto langsung (bukan link halaman toko seperti tokonya.com/product/...).
                </p>
              </div>
            </div>

            {/* Clipboard Paste Hint & Button */}
            <div className="p-4 bg-amber/15 rounded-2xl border border-amber/40 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber text-forest flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ClipboardPaste className="w-4 h-4" />
                </div>
                <div className="text-xs text-ink space-y-1">
                  <p className="font-extrabold text-forest">Cara Paling Mudah & Cepat (Salin Gambar / Ctrl+V):</p>
                  <p className="text-ink-muted leading-relaxed">
                    Di Google Images / website apa saja, cukup <b>klik kanan pada foto produk</b> lalu pilih <b>"Salin Gambar" (Copy Image)</b>. Kembali ke sini dan tekan tombol di bawah ini atau tekan <b>Ctrl + V</b> di keyboard!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClipboardRead}
                disabled={isDownloading}
                className="w-full py-2.5 px-4 bg-amber hover:bg-amber-hover text-forest font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>📋 Tempel Gambar dari Clipboard Sekarang</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: KOLEKSI SEMBAKO POPULER */}
        {activeTab === 'preset' && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-ink-muted">
              Pilih foto sembako atau barang toko yang sudah disiapkan untuk kategori ini:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
              {PRESET_GROCERY_PHOTOS.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => !isDownloading && handleApplyImage(item.url)}
                  className="group p-2 bg-cream-50 hover:bg-cream-100 rounded-2xl border-2 border-cream-300 hover:border-forest/50 cursor-pointer transition-all text-center flex flex-col justify-between"
                >
                  <div className="w-full h-20 rounded-xl overflow-hidden bg-white border border-cream-200 mb-1.5">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-forest bg-forest-surface px-1.5 py-0.5 rounded-full inline-block mb-0.5">
                      {item.category}
                    </span>
                    <p className="text-xs font-bold text-ink truncate">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Downloading state overlay */}
        {isDownloading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-forest" />
            <p className="text-xs font-extrabold text-ink">Mengunduh & mengompres foto untuk produk...</p>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-cream-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
