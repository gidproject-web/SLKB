# Perubahan v1.0 → v1.1

1. Memperbaiki `.board-grid` yang sebelumnya memiliki `inset:auto` setelah `left/top` dan menyebabkan pergeseran angka. Kini overlay angka tepat mengikuti 10×10 kotak papan.
2. Membuat tata letak arena fit-to-viewport (tanpa scroll halaman) di desktop/tablet/HP pada ukuran yang diuji. Navbar dan scoreboard lebih ringkas.
3. Menambah `js/catalog.js`: daftar SD/SMP/SMA, kelas, dan mata pelajaran yang bisa dipilih.
4. Mengganti 24 demo generik dengan 57 soal demo yang diberi metadata jenjang, kelas, mapel, materi.
5. Menambahkan filter bertingkat saat memulai permainan dan mengelola bank soal.
6. Memperbarui form tambah soal dengan jenjang dan kelas, serta fitur edit soal buatan.
7. Menambah `data/contoh-impor-soal.json` dan `data/ringkasan-demo.json`.
8. Mempertahankan aturan 7 ular, 8 tangga, dadu, tabrakan, finish 100, dan scoreboard 2–6 tim.

Perlu penyempurnaan tahap berikutnya: penyelarasan ilustrasi fisik ular/tangga agar betul-betul cocok dengan titik asal dan tujuan; perluasan soal semua kelas/mapel; pengujian di layar sekolah.
