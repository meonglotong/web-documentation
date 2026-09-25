# TeamDocs — Design Spec

**Tanggal:** 2026-09-25
**Status:** Approved by owner
**Repo:** `github.com/meonglotong/web-documentation`
**Deploy target:** VM `172.31.252.197` (CentOS Stream 9)

## 1. Tujuan

Website internal untuk tim: satu tempat untuk **dokumentasi** (gaya GitBook) dan
**file-file penting** (PDF, DOCX, XLSX, gambar, arsip) dengan **versioning**.

## 2. Scope

### In
- Dokumentasi GitBook-style: halaman Markdown, sidebar navigasi (section + page),
  "On this page" TOC, callouts, code block (highlight.js + copy button), search.
- File manager: upload (max 100MB), versioning per nama file, download,
  preview in-browser (PDF, gambar), restore versi (admin), hapus file (admin).
- Auth JWT per user, role `admin` / `user`.
- Admin panel: kelola user, kelola struktur & konten halaman dokumentasi.

### Out (YAGNI)
- Dark mode, multi-bahasa, real-time kolaborasi, komentar, full-text search engine
  (search cukup in-memory di Postgres `ILIKE` + judul), file > 100MB,
  SSO/LDAP, mobile native app.

## 3. Arsitektur

```
Browser
   │  HTTP
   ▼
nginx :3001  (reverse proxy, sudah ada di VM untuk Grafana)
   │
   ▼
Next.js 15 (App Router, TypeScript) — systemd service, port 3001
   ├── API routes / server actions  (auth guard di tiap route)
   ├── Postgres 18  → metadata: users, doc_pages, files, file_versions
   └── Filesystem   → /var/lib/teamdocs/files/<file_id>/<version>.<ext>
                        (di luar webroot, hanya di-stream via API)
```

- Node.js sudah ada di VM; pnpm di-install saat deploy.
- Postgres 18 via repo PGDG (`postgresql18-server`), data dir default,
  db `teamdocs`, user dedikasi `teamdocs` (password dari env).
- File storage flat per file: `<file_id>/<n>.<ext>` — tidak ada subfolder;
  struktur folder dibuat di DB, bukan di disk.

## 4. Data model (Postgres)

### users
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| email | text unique | login identifier |
| name | text | |
| password_hash | text | argon2id |
| role | text | `admin` \| `user` |
| active | bool | default true |
| created_at | timestamptz | |

### doc_pages
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| parent_id | uuid null | self-ref: section (title-only, `is_section=true`) atau page |
| position | int | urutan rendering di sidebar |
| title | text | |
| slug | text unique | URL: `/docs/<slug>` |
| is_section | bool | true = node sidebar tanpa konten |
| body_md | text null | Markdown; null jika section |
| updated_by | uuid → users | |
| updated_at | timestamptz | |

### files
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| name | text unique | nama file; kunci untuk auto-versioning |
| ext | text | tanpa titik |
| current_version_id | uuid → file_versions | pointer versi aktif |
| created_by | uuid → users | |
| created_at | timestamptz | |

### file_versions
| kolom | tipe | catatan |
|---|---|---|
| id | uuid PK | |
| file_id | uuid → files | |
| version | int | per file, 1..n (unik per file) |
| storage_path | text | relatif dari `/var/lib/teamdocs/files` |
| size | bigint | bytes |
| sha256 | text | integritas |
| note | text null | catatan versi (opsional saat upload) |
| uploaded_by | uuid → users | |
| created_at | timestamptz | |

**Aturan versioning:** upload dengan `name` yang sama → INSERT
`file_versions` baru (version = max+1) + `files.current_version_id` digeser.
Versi lama **tidak pernah dihapus** saat upload ulang. Restore = UPDATE
`current_version_id` ke versi lama. Hapus file (admin) = hapus semua
versi + baris disk + baris DB (satu transaksi, lalu unlink file disk).

## 5. Auth & role

- Auth.js (NextAuth v5) provider `credentials`, session **JWT** di cookie
  `httpOnly` + `secure` (di balik nginx).
- Password: **argon2id**.
- Seed admin: env `ADMIN_EMAIL` + `ADMIN_PASSWORD` dipakai oleh skrip
  seed (idempoten: update password bila email sudah ada).
- Matriks izin:

| Aksi | user | admin |
|---|---|---|
| Baca docs & file, download, preview | ✅ | ✅ |
| Upload (file baru / versi baru) | ✅ | ✅ |
| Restore versi, hapus file | ❌ | ✅ |
| Kelola user (tambah, disable, ganti role) | ❌ | ✅ |
| Edit / tambah / pindahkan / hapus halaman docs | ❌ | ✅ |

Route guard: middleware Next cek session; cek role di server action/route.

## 6. UI (layout persis GitBook)

Referensi: `https://api-docs-gitbook-clone.webflow.io`.

- **Top bar sticky:** logo + judul team, search box (client-side, query
  `ILIKE` ke title + body_md, maksimal 50 hasil), avatar user + logout.
- **Sidebar kiri sticky:** tree dari `doc_pages` (section → page), active
  state mengikuti URL.
- **Konten tengah:** max-width 700px, font Inter, rendering Markdown:
  heading, paragraf, list, tabel, link, gambar, code block (highlight.js,
  label bahasa + tombol copy), callout (`> [!info]`, `> [!warning]`,
  `> [!danger]` → styling kuning/merah/hijau seperti template).
- **TOC kanan:** "On this page", auto dari heading h2/h3, anchor links.
- **Halaman:** `/login`, `/docs` (home = page pertama), `/docs/<slug>`,
  `/files` (daftar + upload), `/files/<id>` (detail + riwayat versi),
  `/admin/users`, `/admin/docs` (editor halaman + struktur).
- **Editor docs:** textarea Markdown + tombol preview; simpan = server
  action. Tidak ada editor WYSIWYG.

## 7. API / routes

| Method | Path | Fungsi | Guard |
|---|---|---|---|
| POST | `/api/upload` | multipart (file ≤100MB, note opsional) → file baru/versi baru | login |
| GET | `/api/files` | daftar file (paginasi 100) | login |
| GET | `/api/files/<id>` | metadata + riwayat versi | login |
| GET | `/api/files/<id>/download?version=` | stream dari disk; default versi current; `Content-Disposition` inline utk pdf/gambar, attachment lainnya; support Range | login |
| POST | `/api/files/<id>/versions/<v>/restore` | geser pointer current | admin |
| DELETE | `/api/files/<id>` | hapus semua versi | admin |
| GET/POST/PATCH/DELETE | `/api/admin/users...` | kelola user | admin |
| GET/POST/PATCH/DELETE | `/api/admin/pages...` | kelola doc_pages | admin |
| GET | `/api/search?q=` | hasil pencarian docs (≤50) | login |

Upload: stream langsung ke disk (busboy), hitung sha256 sambil stream;
gagal di tengah → unlink file yatim sebelum respons error.

## 8. Error handling

- 401 tanpa session, 403 role kurang, 404 resource, 413 file > 100MB,
  409 nama file baru tapi ext-nya bentrok dgn aturan — pesan JSON
  `{error: "<manusia>"}` yang langsung ditampilkan UI.
- Disk penuh (ENOSPC) → pesan "server penuh, kontak admin".
- Semua transaksi DB pakai 1 statement/transaction; file disk dihapus
  yatim oleh cleanup setelah transaksi gagal.

## 9. Testing

- **Unit (vitest):** logika versioning (auto-version, restore, urutan),
  parsing callout Markdown, validasi ukuran/ekstensi, slugify.
- **E2E smoke (post-deploy, via curl):** login → upload file kecil →
  upload ulang (versi 2) → download v1 & v2 → restore v1 → cek pointer.
- Tidak ada test UI visual; verifikasi layout manual di browser.

## 10. Deploy (VM 197)

1. `sudo dnf` install PGDG → `postgresql18-server`,
   `sudo postgresql-setup --initdb`, `systemctl enable --now postgresql-18`,
   buat db + user.
2. Install Node 20+ (VM sudah ada Node; cek versi) + pnpm.
3. `git clone` repo → `/opt/teamdocs` → `pnpm install --prod && pnpm build`.
4. `.env.production` (DB_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
   FILES_DIR=/var/lib/teamdocs/files, NEXTAUTH_URL=https://172.31.252.197:3001).
5. Skrip seed admin.
6. systemd `teamdocs.service` (User=teamdocs, ExecStart next start -p 3001).
7. nginx: `server { listen 3001; proxy_pass http://127.0.0.1:3001; }`
   (proxy header standar + `client_max_body_size 110m`).
8. Smoke test §9.

## 11. Asumsi & risiko

- Port 3001 di VM 197 tersedia (Grafana memakai 3000) — verifikasi saat deploy.
- 29GB disk free cukup untuk MVP (file team diperkirakan < 5GB).
- Akses SSH deploy: `agent@172.31.252.197` via key `~/.ssh/id_ed25519`
  (sudo tanpa password).
