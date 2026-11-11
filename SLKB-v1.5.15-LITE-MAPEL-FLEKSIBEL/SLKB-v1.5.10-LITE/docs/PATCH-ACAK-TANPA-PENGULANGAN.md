# Patch acak soal tanpa pengulangan — SLKB v1.5.10 LITE

- Pengaturan soal per siklus: 5, 10, 15, **20, 50, 100, Semua soal**.
- Shuffle ON mengacak urutan pertanyaan dan pilihan jawabannya.
- Semua tim memakai antrean bersama; ID soal yang sudah muncul tidak ditarik lagi sebelum semua soal dalam bank pilihan terpakai.
- Siklus 20/50/100 hanya membatasi jumlah soal dalam batch, **bukan** total soal yang tersedia sepanjang pertandingan.
- Salah/waktu habis tetap dihitung sebagai soal terpakai; mekanisme retry otomatis soal salah sengaja dinonaktifkan agar tidak berlawanan dengan aturan tanpa pengulangan.
- Setelah semua soal terpakai, pengacakan dimulai ulang.
- Fitur dadu, aturan angka 6, bidak, ular/tangga, audio, Cloud, dan pengaturan waktu tidak diubah.
- LITE tidak menyertakan 500 soal PAI XI; jumlah yang tersedia bergantung pada bank lokal dan Master Premium Cloud yang dimuat (maksimum 500 soal Cloud per sesi).

## Pemasangan patch manual
Salin `js/app.js` dan `index.html` dari ZIP patch ke lokasi yang sama di aplikasi lama, lalu muat ulang browser dengan Ctrl+Shift+R. ZIP lengkap juga tersedia.
