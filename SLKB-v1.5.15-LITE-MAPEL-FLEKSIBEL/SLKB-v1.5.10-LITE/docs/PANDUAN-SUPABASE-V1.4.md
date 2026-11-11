# PANDUAN V1.4 — Supabase Bank Soal Pribadi + Bersama (Model C)

**Versi ini dibuat dari game V1.3. Tidak mengganti mesin papan, aturan dadu, 426 soal DEMO, ataupun desain arena satu layar.**

## Apa yang disediakan
- **Offline** (tanpa konfigurasi Supabase): semua fitur game V1.3 dan penyimpanan soal di browser tetap berjalan.
- **Login guru**: masuk/daftar memakai email dan kata sandi via Supabase Auth.
- **Bank Pribadi (Cloud)**: setelah login, soal baru otomatis tersimpan pada akun guru (di server). Guru hanya bisa mengedit/menghapus soal sendiri dengan status Pribadi atau Ditolak.
- **Ajukan ke Admin**: soal Pribadi atau Ditolak → Menunggu; tidak langsung masuk bersama.
- **Persetujuan admin**: admin bisa Setujui (menjadi Bersama) atau Tolak. Persetujuan dikendalikan server SQL/RLS, bukan hanya disembunyikan dalam UI.
- **Bank Bersama**: semua guru yang login bisa melihat/memainkan soal berstatus Disetujui. Guru dapat memainkan soal pribadi miliknya, termasuk yang masih menunggu pemeriksaan. Soal menunggu milik guru lain hanya tampil di antrean admin.
- **Cadangan/import**: JSON per jenjang tetap ada; tersedia Impor JSON Pribadi ke Cloud (maks. 100 soal per file) dan Ekspor Soal Lokal untuk migrasi.

## Langkah 1 — Buat proyek Supabase
1. Kunjungi https://supabase.com/dashboard, buat proyek atau pilih proyek Anda.
2. Di **Authentication > Providers**, aktifkan Email; aktifkan verifikasi email untuk penggunaan publik.
3. Pada **Authentication > URL Configuration**, isi Site URL dan URL Redirect website tempat game dipasang (harus HTTPS). Jangan gunakan `file://` untuk alur email-verifikasi produksi.
4. **Jangan memasukkan `service_role` atau `secret` API key ke JavaScript/HTML**, termasuk ke repository publik.

## Langkah 2 — Buat tabel dan keamanan
1. Supabase Dashboard > **SQL Editor** > **New query**.
2. Salin seluruh isi `supabase/001_cloud_bank_v14.sql`, lalu **Run** sekali.
3. SQL membuat `slkb_user_roles` dan `slkb_questions`, indeks, RLS dan fungsi RPC submit/review.
4. Kolom `status` tidak boleh disunting langsung oleh guru; status hanya berubah lewat fungsi RPC yang memeriksa pemilik atau admin.
5. **Jangan mematikan RLS**. Periksa kebijakan terlebih dahulu jika ada error hak akses. Dokumen: https://supabase.com/docs/guides/database/postgres/row-level-security

## Langkah 3 — Hubungkan website
Buka `config/cloud-config.js`:

```js
window.SLCloudConfig = {
  url: 'https://PROJECT-REF.supabase.co',
  anonKey: 'sb_publishable_...atau-anon-legacy'
};
```

Gunakan **Project URL** dan **publishable key** (atau anon key lama) dari pengaturan API Supabase. Kedua data ini adalah konfigurasi klien; keamanannya tetap bergantung pada SQL RLS yang benar. Jangan pakai service_role.

Jalankan situs dari hosting HTTPS seperti Netlify atau server localhost. Untuk tahap belajar, layar tetap bisa dibuka lewat `index.html`, tetapi Supabase Auth dan redirect/verifikasi dapat bermasalah pada `file://`. Ketika koneksi internet tidak tersedia, game lokal masih dapat dimainkan.

## Langkah 4 — Buat dan tunjuk admin (hanya pemilik proyek)
1. Buka game, pilih **Akun Guru & Cloud**, daftar menggunakan email admin, lalu verifikasi email jika diminta.
2. Buka Supabase SQL Editor sebagai pemilik proyek, jalankan **setelah akun admin benar-benar dibuat**:

```sql
insert into public.slkb_user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'EMAIL_ADMIN_ASLI@DOMAIN.TLD'
on conflict (user_id) do update set role = excluded.role;
```

3. Ganti `EMAIL_ADMIN_ASLI@DOMAIN.TLD` dengan email akun milik Anda; perintah bukan untuk dimasukkan ke kode JavaScript.
4. Logout lalu login ulang / tekan Sinkronkan. Menu **Antrean Persetujuan Admin** akan muncul.
5. Tidak ada registrasi admin dari layar publik, dan pengguna tidak dapat mengubah role sendiri.

## Langkah 5 — Alur guru
1. **Akun Guru & Cloud** → login. Pilih **Bank Soal**.
2. Pada **Simpan soal ke**, pilih **Bank Soal Pribadi**; isi jenjang SD/SMP/SMA, kelas, mapel, materi, pertanyaan, A–D, kunci, pembahasan.
3. Klik **Simpan Soal**. Setelah respons server berhasil, data tersimpan online; belum dibagikan ke guru lain.
4. Pada daftar, klik **Ajukan ke Admin**. Status berubah menjadi **Menunggu Persetujuan**.
5. Admin membuka **Akun Guru & Cloud** → Setujui/Tolak. Setelah setuju, soal muncul pada Bank Bersama guru lain ketika mereka melakukan **Sinkronkan/Refresh Cloud** atau membuka kembali dengan login.
6. Bila ditolak, pemilik dapat memperbaiki soal lalu mengajukan ulang.

## Langkah 6 — Pindahkan soal buatan dari V1.3 ke Cloud
- Pada browser lama, buka Bank Soal → **Ekspor Soal Lokal** untuk mencadangkan hanya soal buatan guru.
- Login pada game V1.4 → Bank Soal → **Impor JSON Pribadi** → pilih file tadi.
- Soal baru masuk sebagai **Pribadi**, bukan otomatis diterbitkan. Untuk file yang lebih besar dari 100 butir, pecah menjadi beberapa JSON.
- Simpan cadangan JSON: jaringan bisa terputus, akun bisa salah, dan jika impor sebagian gagal, beberapa batch awal mungkin telah tersimpan.

## Bagaimana soal terlihat di perangkat lain?
- Login dengan **akun yang sama** → soal pribadi milik akun itu akan dimuat dari server.
- Login dengan **akun berbeda** → hanya soal miliknya + **Bersama yang disetujui** yang terlihat. Soal pribadi milik guru lain tidak terlihat.
- Seluruh pengguna mendapat **426 soal demo V1.3** yang tertanam lokal, meskipun tidak login.
- Cloud memerlukan internet. Buka Bank Soal dan tekan **Refresh Cloud** untuk mengambil revisi terbaru; tidak mengklaim sinkronisasi real-time per detik.
- Login menggunakan email/password Supabase bukan login yang dibuat oleh pengembang sendiri.

## Verifikasi keamanan sebelum berbagi ke publik
- Gunakan dua akun guru A dan B serta satu admin. A buat soal private; B **tidak boleh** bisa membaca/mengubahnya.
- A ajukan soal; B tetap tidak melihatnya. Admin bisa melihat pending.
- Admin setujui; B melihat soal bersama sesudah refresh.
- Pastikan permintaan langsung untuk UPDATE status atau owner_id dari klien biasa ditolak oleh PostgreSQL (izin kolom / RLS).
- Soal yang sudah approved tidak bisa diubah sepihak oleh pemilik; perlu alur revisi pada versi mendatang.
- Jangan menyalin project service key atau password ke publik.
- Untuk produksi publik: aktifkan rate limit, pencegahan spam signup, pengawasan konten, pemeriksaan indeks, kebijakan backup dan privasi sesuai kebutuhan sekolah.

## Batasan versi V1.4
**Belum terkoneksi secara nyata** sampai URL/key diisi, SQL dijalankan, dan akun dibuat. Kode telah dipersiapkan untuk koneksi, tetapi otentikasi dan database cloud tidak dapat diuji secara live tanpa proyek Supabase Anda. Fitur V1.3 tetap berjalan offline.

© 2026 GID Creative Studio • @guruupgradeid
