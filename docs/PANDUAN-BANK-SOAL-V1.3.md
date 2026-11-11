# Panduan Pengembangan Bank Soal V1.3

**GID Creative Studio — Snake & Ladder Knowledge Battle**

## A. Perluasan demo yang sudah tersedia
Game sudah memuat 426 soal latihan awal (SD: 162, SMP: 110, SMA: 154). Sekarang ada setidaknya tiga soal di seluruh kombinasi **kelas dan mata pelajaran yang terdaftar**. Pilihan topik per kombinasi akan muncul mengikuti materi pada soal. Ini bukan bank asesmen kurikulum final dan tidak menggantikan proses penyelarasan dengan CP, TP, ATP, dan buku pembelajaran.

## B. Cara menambahkan satu soal
1. Buka `index.html`, pilih **Bank Soal** dari Menu Utama.
2. Pada formulir **Tambah Soal Baru** pilih **Jenjang** (SD/SMP/SMA), **Kelas**, dan **Mata Pelajaran**. Jika mapel belum tersedia, gunakan opsi **Lainnya**.
3. Pada kolom **Bab / materi**, tulis topik yang konsisten, misalnya `Bilangan Bulat`, `Berpikir Kritis`, atau `Perubahan Wujud`.
4. Isi pertanyaan dan pilihan A–D. Tentukan kunci dan pembahasan.
5. Tekan **Simpan Soal**. Soal buatan akan langsung terlihat pada filter jenjang/kelas/mapel/materi.
6. Ulangi sampai materi mempunyai jumlah soal yang cukup. Saat game berlangsung, pilih kombinasi yang sama pada Pengaturan Tim.

## C. Cara menambahkan puluhan soal pada satu materi dengan lebih cepat
1. Pada toolbar Bank Soal, pilih **Jenjang → Kelas → Mata Pelajaran**. Materi boleh dipilih jika sudah tersedia; jika belum ada, biarkan `Semua Materi`.
2. Klik **📄 Template Materi Ini**. File JSON yang terunduh otomatis membawa jenjang, kelas, dan mapel terpilih.
3. Buka berkas menggunakan editor teks. Ganti seluruh `GANTI_*` untuk `topic`, `question`, pilihan, dan `explanation`.
4. Jika diperlukan 10–20 soal, gandakan objek JSON di dalam array `questions` dengan koma antarobjek. Perbaiki masing-masing soal dan kunci.
5. Simpan file dengan ekstensi `.json`, lalu klik **⬆ Impor JSON** dan pilih file.
6. Periksa jumlah soal pada filter Bank Soal. Klik **⬇ Ekspor JSON** untuk cadangan.

**Struktur contoh satu soal:**
```json
{
  "version": 2,
  "questions": [
    {
      "level": "SMA",
      "grade": 11,
      "subject": "PAI & Budi Pekerti",
      "topic": "Berpikir Kritis",
      "question": "Sikap yang tepat saat menerima informasi viral adalah …",
      "choices": [
        "Memeriksa sumber dan bukti",
        "Menyebarkan tanpa membaca",
        "Mempercayai semua pesan",
        "Menghapus semua sumber"
      ],
      "answer": "A",
      "explanation": "Tabayyun membantu menghindari penyebaran informasi keliru."
    }
  ]
}
```

## D. Cara menyiapkan bank per jenjang/mapel
- **SD**: buat paket per kelas (1–6) dan per mata pelajaran; penamaan materi sesuaikan tujuan pembelajaran.
- **SMP**: buat paket per kelas (7–9), lalu per mapel dan materi.
- **SMA**: buat paket per kelas (10–12), lalu per mapel dan materi.
- Bank soal akan terbaca otomatis dari metadata. Tidak perlu menaruh JSON di folder terpisah setiap kali bermain; cukup **impor** ke Bank Soal.
- Jika seluruh soal satu materi sudah terpakai, game dapat menggunakan ulang soal sesuai pengaturan siklus.

## E. Aturan & keamanan data
- Gunakan `level` **SD/SMP/SMA**, `grade` sesuai kelas, dan **empat** pilihan teks `choices`.
- Kunci `answer` adalah A, B, C, D atau indeks 0–3.
- Maksimal 1.000 soal per sekali impor JSON.
- Soal demo ditandai `Demo` dan tidak bisa diedit di dalam game. Guru bisa mengimpor salinan yang dimodifikasi sebagai soal buatan.
- Soal buatan tersimpan di browser lokal pada perangkat yang dipakai. Setelah selesai menambah soal, **Ekspor JSON** dan simpan cadangannya. Menghapus data browser dapat menghapus bank kustom.
- File `data/demo-perluasan-SD-v1.3.json`, `...-SMP-...`, dan `...-SMA-...` adalah **data demo bawaan**. Jangan impor ulang file tersebut sebagai paket soal baru karena soalnya sudah termasuk dalam game.
