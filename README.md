# Snake & Ladder: Knowledge Battle V1.5 — Demo + Premium (Lynk.id)

## Yang tetap dipertahankan dari V1.4

- Arena 100 kotak presisi, pilihan 2–6 tim, enam bidak 3D.
- Dadu memperlihatkan angka hasil **sebelum soal**, tiga angka 6 berturut-turut: bonus ketiga hangus.
- Jawaban benar → bidak maju; salah → tetap. Ular, tangga, tabrakan, scoreboard, kemenangan kotak 100.
- 426 soal demo lintas SD/SMP/SMA (bukan konten premium yang ditelaah).

## Perubahan V1.5

1. Tombol **Beli Premium melalui Lynk.id**. URL asli di `config/store-config.js` (kosong sampai produk dibuat).
2. Login/daftar guru Supabase yang sudah ada tetap digunakan.
3. Pengajuan **nomor transaksi Lynk.id**, verifikasi **manual oleh admin**, lisensi tersimpan pada akun.
4. Bank **Master Premium** di tabel tersendiri; **tidak ada soal premium di ZIP game**.
5. Akses Bank Bersama dibatasi ke admin dan akun Premium aktif lewat SQL migrasi.
6. SD kelas 1–3 menggunakan 3 opsi A–C; kelas 4–12 menggunakan 4 opsi A–D.
7. Impor file 100 soal master dilakukan oleh admin lewat menu Akun Guru & Cloud.

## Menjalankan demo

Ekstrak ZIP → buka `index.html` melalui Chrome/Edge. Mode demo tetap dapat dimainkan tanpa koneksi cloud. Untuk Cloud sungguhan gunakan server lokal saat uji dan HTTPS pada saat publikasi.

## Penting untuk pemilik

Jangan pernah membagikan **ZIP ADMIN PRIVATE** kepada pembeli karena berisi 100 soal lengkap. Selalu gunakan paket game **LITE** untuk distribusi publik. Simpan salinan konfigurasi Supabase yang sudah Anda isi dan pindahkan ke `config/cloud-config.js` dalam V1.5. File paket ini sengaja mengosongkan nilai project agar tidak otomatis berkomunikasi dengan instance yang migrasinya belum selesai.

**Langkah migrasi wajib:** Supabase SQL Editor → jalankan `supabase/002_license_premium_v15.sql`. Baru setelah itu sambungkan Cloud dan impor soal dengan akun admin.

Detail: `docs/PANDUAN-LISENSI-V1.5.md`.

**Status:** Uji browser offline + simulasi 3 akun lulus. **Belum ada verifikasi keamanan RLS/akses pada Supabase nyata**, dan pembayaran Lynk.id belum terhubung otomatis. Jangan jual sebelum pengujian produksi.

© 2026 GID Creative Studio • @guruupgradeid
