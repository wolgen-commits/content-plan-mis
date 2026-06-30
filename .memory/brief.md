# Project Brief — Content Planner System

## Deskripsi

Sistem manajemen content planning untuk tim marketing **Magenta**. Menggantikan proses manual (spreadsheet/Notion) dengan platform terpadu yang mencakup perencanaan, persetujuan, produksi aset, hingga publikasi konten.

## Target Pengguna

| Role | Tanggung Jawab |
|---|---|
| **Admin** | Kelola user, akses penuh semua fitur |
| **Content Planner** | Buat brief konten, ajukan ke manager, review hasil aset |
| **Manager Marketing** | Setujui atau tolak content plan |
| **Designer** | Terima brief, upload hasil desain |
| **Videografer** | Terima brief, upload hasil video |

## Core Features

### 1. Content Plan CRUD
- Field: judul, tipe konten, channel, topik, materi/script, brief visual, caption, referensi, tags
- Assignee: bisa pilih designer dan/atau videografer

### 2. Approval Workflow
```
draft → pending_approval → approved → in_production → submitted → done
                        ↘ rejected (balik ke planner)
```

### 3. Kalender
- View bulanan/mingguan semua content plan
- Warna per status
- Drag & drop untuk reschedule (content_planner only)

### 4. Kanban Board
- 6 kolom: Briefing → Design in Progress → Video in Progress → Review → Approved → Published
- Drag & drop antar kolom (optimistic update)
- Real-time sync via Supabase Realtime

### 5. File Upload (Designer/Videografer)
- Upload desain atau video ke Supabase Storage
- Signed URL — file tidak melewati server Laravel
- Content planner approve/reject hasil

### 6. Notifikasi Real-time
- Bell di topbar dengan unread count
- Toast otomatis saat ada notifikasi baru
- Halaman notifikasi lengkap dengan filter unread

### 7. Dashboard
- KPI stats per status
- Status bar chart
- Recent content plans
- Quick actions per role

## Design System

Mengikuti **Magenta ERP Design System**:
- Brand color: `#BB2649` (magenta)
- Sidebar: `#1A1A1C` (dark)
- Font: DM Sans (sans), DM Mono (mono)
- Border radius: card=10px, button=6px
- Status colors: success=green, warning=amber, danger=red, info=blue

## Out of Scope (saat ini)

- Export PDF
- Integrasi jadwal posting otomatis ke media sosial
- Analytics konten
- Komentar/thread diskusi per content plan
