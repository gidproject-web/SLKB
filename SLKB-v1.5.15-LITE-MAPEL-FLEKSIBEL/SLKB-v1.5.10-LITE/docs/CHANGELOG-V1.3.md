# Changelog V1.3 — Identitas pengembang & perluasan bank soal

## Perubahan yang sudah diterapkan
1. Label Facebook di halaman Info Pengembang menjadi **Facebook · Ika Lathifah**. Karena URL profil pribadi belum diberikan, tautannya tetap menuju pencarian Facebook bernama Ika Lathifah; tidak membuat URL profil berdasarkan tebakan.
2. Mengganti **Blog** dengan **Website · guruupgradeid.com** yang menuju `https://www.guruupgradeid.com` dan dapat diklik.
3. Menambahkan **369 soal DEMO** di `js/questions-expanded.js`; total **426 soal** dari bank lama 57 + tambahan 369.
4. Semua jenjang **SD kelas 1–6 (8 mapel), SMP kelas 7–9 (10 mapel), SMA kelas 10–12 (15 mapel)** memiliki setidaknya tiga contoh soal per kombinasi kelas-mapel. Total **123 kombinasi**. Ini bank latihan awal, belum diverifikasi terhadap seluruh CP/ATP.
5. Bank Soal memiliki tombol **Template Materi Ini**. Pilih **Jenjang + Kelas + Mapel**, lalu unduh template JSON sesuai pilihan. Isi/ganti seluruh teks penanda GANTI_* sebelum diimpor.
6. Mekanisme pertandingan V1.2 tidak diubah: tampilan angka dadu sebelum soal, bonus 6 hingga dua kali, angka 6 ketiga hangus, tabrakan, ular, tangga, dan arena satu layar.
7. Mempertahankan `slkb.custom.v1` untuk penyimpanan soal buatan guru sehingga pembaruan ke V1.3 tidak sengaja menghapus soal pada browser yang sama. **Tetap cadangkan JSON** sebelum ganti versi.

## Statistik demo
| Jenjang | Lama | Tambahan | Total | Kelas | Mapel |
|---|---:|---:|---:|---|---:|
| SD | 18 | 144 | 162 | 1–6 | 8 |
| SMP | 20 | 90 | 110 | 7–9 | 10 |
| SMA | 19 | 135 | 154 | 10–12 | 15 |
| **Total** | **57** | **369** | **426** | 1–12 | 33 daftar mapel lintas jenjang |

## Hal yang masih menjadi catatan
- Soal demo bukan soal ujian siap pakai, terutama terkait kecocokan kelas dan kurikulum. Beberapa contoh konsep digunakan kembali untuk kelas berbeda; perlu ditinjau guru sebelum digunakan untuk asesmen.
- Perkembangan ini belum membuat generator AI soal atau sinkronisasi penyimpanan cloud.
- Tampilan 3D ilustratif ular/tangga masih memerlukan penyelarasan dengan titik asal-tujuan pada mesin.
- File `assets/ui/ui-10-info-pengembang.png` adalah mockup visual awal, bukan halaman aktif. Label Blog pada mockup lama **bukan** link yang digunakan game; halaman HTML Info Pengembang telah menampilkan Website.
