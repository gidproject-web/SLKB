# Panduan Bank Soal — Snake & Ladder Knowledge Battle V1.2

## A. Menambahkan soal satu per satu (tanpa pemrograman)
1. Buka `index.html` lalu pilih **Bank Soal** di menu utama.
2. Pada formulir **Tambah Soal Baru**, pilih **Jenjang**: SD, SMP, atau SMA.
3. Pilih **Kelas** (SD 1–6, SMP 7–9, SMA 10–12).
4. Pilih **Mata Pelajaran** (misalnya Matematika). Jika tidak ada, pilih **Lainnya (tulis sendiri)**.
5. Isi **Bab / materi** secara konsisten, contoh `Bilangan Bulat`, `Puasa`, atau `Gerak`.
6. Isi pertanyaan, pilihan jawaban A–D, kunci jawaban, dan pembahasan (jika ada).
7. Klik **Simpan Soal**. Soal langsung tersedia untuk dipilih di pengaturan pertandingan.
8. Gunakan filter **Jenjang → Kelas → Mata Pelajaran → Materi** di atas daftar untuk memeriksa soal yang telah ditambahkan.

**Contoh pengelompokan:** `SD → Kelas 5 → Matematika → Bilangan` dan `SMP → Kelas 8 → IPA → Gerak` adalah bank yang terpisah.

## B. Memasukkan puluhan soal sekaligus lewat JSON
1. Klik **Unduh Contoh JSON** pada layar Bank Soal (tersedia juga di `data/`).
2. Buka file di editor teks biasa dan gunakan struktur berikut per soal:

```json
{
  "level": "SMA",
  "grade": 11,
  "subject": "PAI & Budi Pekerti",
  "topic": "Adab Media Sosial",
  "question": "Sikap yang benar sebelum membagikan informasi adalah ...",
  "choices": ["Memeriksa kebenarannya", "Menyebarkan segera", "Menambah rumor", "Mengabaikan sumber"],
  "answer": "A",
  "explanation": "Tabayyun berarti memeriksa kebenaran informasi."
}
```

3. Salin objek tersebut untuk setiap soal di dalam array `questions`, dengan koma antarobjek. Nama mapel dan materi wajib konsisten agar filternya mengelompokkan dengan benar.
4. Simpan file sebagai `.json` dan klik **Impor JSON**, kemudian pilih berkas yang sudah disimpan.
5. Pilih jenjang/kelas/mapel/materi di filter Bank Soal untuk memastikan data masuk. Ulangi untuk materi lain.
6. Klik **Ekspor JSON** untuk cadangan pribadi. Data tersimpan di browser lokal, bukan di server.

### Ketentuan teknis impor
- `level`: `SD`, `SMP`, `SMA` (huruf besar).
- `grade`: SD 1–6; SMP 7–9; SMA 10–12.
- `choices`: tepat empat opsi teks, urutan A–D.
- `answer`: `A`, `B`, `C`, atau `D` (atau angka indeks 0–3).
- Maksimal 1000 soal per berkas impor; sebaiknya impor per jenjang/mapel.
- Semua soal contoh bawaan bertanda **Demo**, tidak dapat diedit. Soal impor dan buatan guru bisa diedit atau dihapus.

## C. Memainkan bank soal per materi
1. Kembali ke menu **Mulai Bermain**.
2. Pilih 2–6 tim lalu beri nama.
3. Pilih **Jenjang → Kelas → Mata Pelajaran → Materi**.
4. Perhatikan jumlah soal tersedia. Jika nol, pilih kategori lain atau tambah soalnya terlebih dahulu.
5. Klik **Mulai Pertandingan**.

## D. Catatan keamanan data
Soal kustom disimpan di penyimpanan browser. Menghapus data browser, memakai mode privat, atau berpindah perangkat dapat menghilangkan soal lokal. Selalu cadangkan melalui **Ekspor JSON** setelah menyunting bank soal. Ekspor memasukkan data demo dan data buatan; saat impor, soal demo otomatis dilewati.
