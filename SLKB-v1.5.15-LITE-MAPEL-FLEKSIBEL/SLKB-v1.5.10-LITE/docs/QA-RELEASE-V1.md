# QA Release — Snake & Ladder Knowledge Battle v1.0

**Pemeriksaan otomatis (lulus):**

1. Pemetaan 100 kotak, zigzag dan koordinat tersusun unik.
2. Pembentukan 2, 3, 4, 5 dan 6 tim.
3. Jawaban salah tidak menggerakkan bidak dan giliran berpindah.
4. Jawaban benar menggerakkan bidak sesuai dadu.
5. Tangga 3→22 dan ular 36→6.
6. Tabrakan biasa di kotak 6, tabrakan setelah menaiki tangga, dan tabrakan setelah turun ular.
7. Hasil melebihi 100 tetap di kotak sebelumnya; mendarat tepat 100 menang.
8. Uji DOM browser: menu → pengaturan 6 tim → arena 100 kotak → lempar dadu → 4 opsi → feedback → lanjut giliran, tanpa JavaScript exception.
9. Uji viewport mobile 390 piksel: tidak ditemukan overflow horizontal pada layar game yang diuji.

**Batas verifikasi:** screenshot asli seluruh layar dengan asset loading di browser penuh belum diselesaikan di lingkungan pengujian. Komposisi gambar ular/tangga masih **visual preview** dan belum diaudit kecocokan ujung visual terhadap seluruh 15 rute. Pemetaan aturan sudah diverifikasi terpisah.

**Peta tetap:**
Ular: 98→78, 95→56, 88→67, 74→53, 62→19, 49→11, 36→6.
Tangga: 3→22, 8→30, 20→41, 28→55, 43→71, 57→76, 70→91, 80→99.

**Rencana QA lanjutan:** pemeriksaan visual di perangkat fisik, pengujian latensi animasi pada perangkat lambat, aksesibilitas, dan review koneksi setiap ujung aset terhadap kotak.
