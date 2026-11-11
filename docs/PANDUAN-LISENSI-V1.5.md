# PANDUAN V1.5 — DEMO GRATIS + PREMIUM LYNK.ID

**Produk:** Snake & Ladder: Knowledge Battle • GID Creative Studio  
**Basis:** V1.4, mesin game 2–6 tim dan aturan dadu dipertahankan.  
**Status:** Prototipe siap uji; **belum terhubung dan diuji pada Supabase asli** di paket rilis ini.

## A. Memahami pembagian berkas

- **ZIP Game LITE / FULL** hanya berisi game, aset, dan **soal DEMO**. File 100 soal premium **tidak boleh** masuk ke kedua paket yang dibagikan.
- **ZIP ADMIN PRIVATE (terpisah)** berisi 100 soal revisi A–C, lembar telaah CSV, serta SQL migrasi. Hanya pemilik/admin yang menyimpan berkas ini.
- Data premium sungguhan tersimpan pada tabel `public.slkb_master_questions` setelah admin mengimpornya.
- Soal guru pribadi dan Bank Bersama V1.4 tetap di tabel `public.slkb_questions`, namun akses bersama kini hanya untuk admin/premium.

## B. Urutan instalasi pada proyek Supabase YANG SUDAH memiliki V1.4

1. **Backup** data Supabase terlebih dahulu (minimal ekspor dua tabel lama, khususnya `slkb_questions` dan `slkb_user_roles`).
2. Masuk ke Supabase → **SQL Editor** → **New query**.
3. Salin file `supabase/002_license_premium_v15.sql` → **Run**. SQL bersifat tambahan dan tidak menghapus akun admin.
4. Jangan jalankan ulang `001_cloud_bank_v14.sql` setelah migrasi, karena versi lama memiliki kebijakan baca soal Bersama yang lebih luas.
5. Periksa menu Table Editor: seharusnya ada `slkb_entitlements`, `slkb_activation_requests`, `slkb_master_questions`.
6. Pastikan admin lama tetap di `slkb_user_roles` dengan role `admin`.
7. Di `config/cloud-config.js`, **pindahkan Project URL dan publishable/anon key milik proyek Anda**. Jangan masukkan secret/service_role key.
8. Login sebagai admin dari game. Buka **Akun Guru & Cloud → Impor Master Premium JSON**, unggah berkas 100 soal dari ZIP ADMIN PRIVATE.
9. Periksa jumlah data pada `slkb_master_questions` di Table Editor. Target paket pertama: 100 baris.
10. Untuk contoh pengujian lisensi, buat akun guru **free** berbeda, bayar melalui alur uji manual, ajukan nomor transaksi, cek transaksi dari dashboard Lynk.id, lalu setujui dari akun admin. Pastikan soal hanya terlihat setelah aktivasi.

> Jika Anda belum mengaktifkan SQL 002, jangan menerbitkan produk: model keamanan V1.4 tidak memisahkan premium dan gratis.

## C. Konfigurasi URL Lynk.id

Buka `config/store-config.js`, isi `lynkProductUrl` dengan **URL halaman produk Lynk.id yang sebenarnya**, misalnya setelah produk dibuat. Jangan gunakan URL contoh. Tombol Beli Premium belum akan membuka halaman penjualan apabila kolom ini kosong.

## D. Alur pengguna

1. Pengunjung tanpa login menggunakan game dalam mode **Demo Gratis**, dengan soal demo bawaan.
2. Calon pembeli mengeklik **Beli Premium di Lynk.id**.
3. Sesudah pembayaran, pembeli **mendaftar/login** memakai emailnya dan mengisi **nomor transaksi** yang asli.
4. Admin memverifikasi pembayaran **secara manual di dashboard Lynk.id**, bukan semata-mata percaya nomor yang diketik pengguna.
5. Admin memilih **Aktivasi** atau **Tolak** dalam panel admin. Hanya akun admin yang boleh memutuskan.
6. Pembeli menekan **Sinkronkan** atau login ulang. Bank Soal Master Premium dan Bank Bersama terbuka bila lisensi `active`.
7. Untuk menangguhkan lisensi, gunakan SQL Editor dengan akun pemilik proyek (contoh di bagian H), bukan mengubah JavaScript.

**Belum ada webhook/pembayaran otomatis** di V1.5. Status transaksi tidak boleh dipercaya dari browser.

## E. Aturan opsi A–C / A–D

- SD kelas 1–3: **3 opsi** A, B, C.
- SD kelas 4–6, SMP, SMA: **4 opsi** A, B, C, D.
- Form otomatis menyembunyikan opsi D untuk kelas rendah.
- Soal demo V1.4 lama yang memiliki 4 opsi pada SD kelas 1–3 dikonversi **saat ditampilkan**, dengan menghapus salah satu pengecoh dan mempertahankan jawaban benar. Paket master resmi yang baru selalu memakai 3 opsi untuk kelas rendah.
- Pembahasan dan kunci harus diperiksa kembali setelah impor.

## F. Menguji RLS SEBELUM DIJUAL

Uji dengan tiga sesi browser berbeda:

| Pengujian | Hasil yang HARUS terjadi |
|---|---|
| Pengunjung tanpa login | Hanya soal demo lokal, tidak dapat `SELECT` Master Premium dari API |
| Guru free/login tanpa pembelian | Tidak dapat `SELECT` Master Premium dan Bank Bersama, tidak dapat menulis soal pribadi Cloud |
| Guru sudah diaktivasi admin | Dapat mengambil Master Premium dan mengelola soal pribadi, tidak dapat mengaktifkan dirinya sendiri |
| Admin | Dapat melihat antrean transaksi, menyetujui, dan impor master soal |
| Non-admin mencoba RPC `slkb_review_activation` | Ditolak oleh database |
| Non-admin mencoba insert `slkb_entitlements` | Ditolak oleh GRANT/RLS |
| Guru berpindah browser dan login kembali | Soal Cloud muncul dari database |
| Logout saat pernah membuka Master Premium | Cache premium dalam memori dan deck sesi dibersihkan |

**Tidak ada perlindungan sempurna terhadap penyalinan soal oleh akun pembeli sah** setelah soal ditampilkan di layar. Yang dilindungi adalah akses tanpa lisensi dan ekspor massal dari tombol UI.

## G. Tentang penyimpanan

- Soal demo: bundel JavaScript lokal. Tidak butuh Supabase untuk bermain.
- Soal pribadi Cloud: database terikat ke akun guru.
- Bank Master Premium: database terpisah; tidak ditaruh ke paket game publik.
- Soal lokal guru: localStorage browser; **cadangkan dengan Ekspor JSON**, karena berganti browser atau membersihkan data dapat menghilangkannya.
- Status lisensi: database `slkb_entitlements` dengan pemeriksaan Row Level Security.

## H. Menangguhkan akses (admin SQL Editor)

> Ganti email dengan akun yang tepat; **jangan** jalankan untuk akun admin tanpa alasan.

```sql
update public.slkb_entitlements
set status='suspended', updated_at=now()
where user_id = (select id from auth.users where email='contoh-pembeli@example.com');
```

## I. Catatan uji

Uji browser **offline** dan uji **mock** tiga akun telah dilakukan. SQL migrasi belum dijalankan pada server Supabase asli di sesi ini; tidak boleh dinyatakan aman untuk produksi sebelum uji nyata, RLS, serta transaksi dilakukan.
