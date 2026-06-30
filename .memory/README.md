# .memory — AI Context Files

Folder ini dibaca otomatis oleh Claude di setiap sesi baru.
Selalu baca semua file berikut sebelum mulai bekerja:

## Urutan Baca

1. **[activecontext.md](activecontext.md)** — ⚡ Fokus sesi ini, status terbaru, sedang di-debug apa
2. **[brief.md](brief.md)** — Deskripsi project, tujuan, dan scope
3. **[techcontext.md](techcontext.md)** — Stack teknologi, setup, env, dan keputusan teknis
4. **[systempatterns.md](systempatterns.md)** — Konvensi kode, pola arsitektur, dan aturan yang harus diikuti
5. **[progress.md](progress.md)** — Checklist fitur: apa yang sudah selesai, sedang dikerjakan, dan belum

## Aturan untuk AI

- Baca `progress.md` untuk tahu apa yang harus dikerjakan selanjutnya
- Update `progress.md` setiap kali menyelesaikan atau memulai task
- Jangan ubah `brief.md` dan `techcontext.md` kecuali ada keputusan arsitektur baru
- Tambahkan pola baru ke `systempatterns.md` jika ditemukan pola yang konsisten di codebase
- Selalu cek `techcontext.md` sebelum membuat file baru agar tidak melanggar konvensi
