# Active Context

> File ini diupdate setiap sesi aktif.
> Berisi fokus sesi saat ini, keputusan terbaru, dan hal yang sedang di-debug.

---

## Sesi Aktif: 2026-06-24

### Fokus Saat Ini

**Menjalankan aplikasi di lokal untuk pertama kali dan debug koneksi.**

---

### Status Terakhir

| Komponen | Status |
|---|---|
| Database (Supabase) | ✅ Terkoneksi via pooler |
| Seeder | ✅ 5 user berhasil di-seed |
| Backend (`php artisan serve`) | ✅ Berjalan di port 8000 |
| Frontend (`npm run dev`) | ✅ Berjalan di port 3001 |
| Login di browser | 🔄 Sedang diuji — CSRF fix baru diterapkan |

---

### Perubahan Terakhir Dibuat

1. **Hapus `statefulApi()`** dari `backend/bootstrap/app.php`
   - Penyebab: CSRF token mismatch saat login
   - Alasan: kita pakai Bearer token, bukan cookie SPA auth

2. **Buat folder `.memory/`** dengan file:
   - `README.md`, `brief.md`, `techcontext.md`, `systempatterns.md`, `progress.md`

3. **Update `CLAUDE.md`** — tambah referensi ke folder `.memory`

---

### Sedang Di-debug

**Form "Tambah Content Plan" gagal simpan** — invalid input judul & referensi

Root cause yang ditemukan:
1. `PlainInput/PlainTextarea/PlainSelect` tidak pakai `forwardRef` → `ref` dari `register()` tidak sampai ke DOM → react-hook-form tidak bisa baca nilai field saat submit → title selalu dianggap kosong
2. Row referensi dengan URL kosong lolos masuk array dan gagal validasi zod `z.string().url()`

Fix yang diterapkan (2026-06-24):
- Refactor `PlainInput`, `PlainTextarea`, `PlainSelect` di `new/page.tsx` pakai `forwardRef`
- Ubah zod schema references url dari `z.string().url()` → `z.string().optional()`
- Filter empty references di `onSubmit` sebelum kirim ke API
- Terapkan fix yang sama ke `edit/page.tsx`

---

### Hal yang Belum Dikerjakan

- [ ] Konfirmasi form tambah plan berhasil simpan setelah fix
- [ ] Aktifkan Supabase Realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE content_plans; ALTER PUBLICATION supabase_realtime ADD TABLE notifications;`)
- [ ] Buat bucket `content-submissions` di Supabase Storage (private)
- [ ] Test full workflow: buat plan → submit → approve → assign → upload → approve submission → done

---

### Catatan untuk Sesi Berikutnya

- Frontend berjalan di **port 3001** (bukan 3000 default)
- Login sudah berhasil ✅ (CSRF fix: hapus `statefulApi()` dari `bootstrap/app.php`)
- Setelah edit `.env` backend, **selalu** jalankan `php artisan config:clear`
- Supabase free tier bisa **pause** — cek dashboard jika koneksi timeout
