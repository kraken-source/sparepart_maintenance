# Sparepart Maintenance

Aplikasi web untuk mencatat dan memantau penggantian sparepart kendaraan, dengan dashboard 3D yang partnya bisa diklik.

- `backend/` – REST API Laravel 12 (PHP 8.2+)
- `frontend/` – React + Vite + React Three Fiber

## Prasyarat

- PHP **8.2+** dengan ekstensi `zip`, `pdo_sqlite` (atau `pdo_mysql`), `fileinfo`, `openssl`
  - Di Laragon: pastikan `extension=zip` aktif di `php.ini`, jika tidak `composer install` sangat lambat / timeout
- Composer 2
- Node.js 20+

## Menjalankan di localhost

```bash
# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite      # PowerShell: New-Item database\database.sqlite -ItemType File
php artisan migrate --seed          # tabel + data contoh Hyundai Palisade
php artisan serve                   # http://127.0.0.1:8000

# Frontend (terminal lain)
cd frontend
npm install
npm run dev                         # http://localhost:5173
```

Vite meneruskan `/api/*` ke `127.0.0.1:8000`, jadi backend harus berjalan lebih dulu.

## Login

Seeder membuat user development `admin@example.com` dengan password `password`
(bisa diganti lewat `SEED_ADMIN_PASSWORD` di `.env` sebelum seeding).

Tidak ada halaman registrasi. User dibuat atau di-reset password-nya lewat:

```bash
php artisan user:create "Nama User" email@contoh.com   # password ditanyakan secara interaktif
```

Autentikasi memakai token Laravel Sanctum (berlaku 7 hari, atur dengan `SANCTUM_EXPIRATION` dalam menit).
Login dibatasi 5 percobaan per menit per email + IP.

Untuk MySQL, ubah `DB_CONNECTION=mysql` beserta `DB_*` lainnya di `backend/.env`.

## Model 3D

Tanpa file model, dashboard memakai model prosedural berproporsi Hyundai Palisade
(`frontend/src/components/PalisadeModel.jsx`).

Untuk memakai file `.glb`:

1. Beri nama objek/mesh di Blender sesuai kolom `parts.mesh_name` (mis. `tire_front_left`, `battery`).
2. Simpan ke `frontend/public/models/<nama>.glb`.
3. Isi kolom *URL model 3D* kendaraan dengan `/models/<nama>.glb`.

Sudut kamera awal bisa diatur lewat URL: `?view=front|side|rear|top`.

## API

Semua endpoint kecuali `POST /api/login` membutuhkan header `Authorization: Bearer <token>`.

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/login` | `{email, password}` → `{token, user}` |
| GET | `/api/me` | user yang sedang login |
| POST | `/api/logout` | cabut token saat ini |
| GET/POST | `/api/vehicles` | daftar / tambah kendaraan |
| GET/PUT/DELETE | `/api/vehicles/{id}` | detail / ubah / hapus |
| GET | `/api/vehicles/{id}/parts-status` | status tiap part (untuk pewarnaan 3D) |
| GET/POST | `/api/parts` | daftar / tambah part |
| GET/PUT/DELETE | `/api/parts/{id}` | detail / ubah / hapus |
| GET/POST | `/api/maintenance-records` | daftar (filter `vehicle_id`, `part_id`, `q`) / tambah |
| GET/PUT/DELETE | `/api/maintenance-records/{id}` | detail / ubah / hapus |

