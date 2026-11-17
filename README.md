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

## Login, peran & pengguna

Seeder membuat admin development `admin@example.com` dengan password `password`
(ganti lewat `SEED_ADMIN_PASSWORD` di `.env` sebelum seeding). **Ganti password ini sebelum dipakai orang lain.**

| Aksi | Admin | User |
|---|---|---|
| Lihat kendaraan beserta catatan, laporan & notifikasinya | ✅ semua | ✅ milik sendiri |
| Tambah/edit/hapus kendaraan | ✅ semua, bisa pindah pemilik | ✅ milik sendiri |
| Tambah/edit catatan maintenance, upload/hapus foto nota | ✅ | ✅ kendaraan sendiri |
| Hapus catatan maintenance | ✅ | ❌ |
| Tambah/edit/hapus master Part | ✅ | ❌ |
| Kelola pengguna (menu Pengaturan → Pengguna) | ✅ | ❌ |
| Ganti password sendiri (ikon kunci di sidebar) | ✅ | ✅ |

Aturan pengaman: admin tidak bisa menurunkan peran, menonaktifkan, atau menghapus dirinya sendiri;
pengguna yang dinonaktifkan atau di-reset password-nya langsung keluar dari semua perangkat.

**Kepemilikan kendaraan:** setiap kendaraan punya satu pemilik. Data kendaraan milik user lain
dijawab 404 "Data tidak ditemukan" (keberadaannya tidak dibocorkan). Notifikasi pengingat dikirim
ke pemilik kendaraan dan admin. User yang masih memiliki kendaraan tidak bisa dihapus.

Jalur darurat dari terminal (mis. semua admin lupa password):

```bash
php artisan user:create "Nama" email@contoh.com --admin   # buat admin / reset password + aktifkan kembali
```

Autentikasi memakai token Laravel Sanctum (berlaku 7 hari, atur dengan `SANCTUM_EXPIRATION` dalam menit).
Login dibatasi 5 percobaan per menit per email + IP.

## Automated test

```bash
# Backend (PHPUnit) – 84 test: usia pakai, API CRUD, lampiran, login, peran & pengguna, kepemilikan, jenis kendaraan,
# pengingat & anti-spam, laporan biaya, pesan Bahasa Indonesia
cd backend
php artisan test

# Frontend (Vitest) – 28 test: format tanggal/angka, skala grafik, pesan error
cd frontend
npm test
```

Test backend selalu memakai database **di memori** (`phpunit.xml`), dan `tests/TestCase.php`
menghentikan test bila tersambung ke database lain, sehingga data asli tidak pernah tersentuh.
Upload lampiran di test memakai `Storage::fake()`.

Jalankan kedua perintah di atas sebelum commit.

## Pengingat jatuh tempo

Part yang mendekati / melewati jadwal ganti memunculkan notifikasi di lonceng aplikasi.
Pemeriksaan berjalan otomatis setiap hari pukul 07.00 dan setiap kali catatan maintenance
atau odometer berubah. Bisa juga manual: tombol **Periksa sekarang** di lonceng, atau

```bash
php artisan maintenance:check-due
```

Jadwal harian membutuhkan scheduler Laravel yang berjalan:

- Development: `php artisan schedule:work` (biarkan terminal terbuka)
- Server Linux: cron `* * * * * cd /path/backend && php artisan schedule:run >> /dev/null 2>&1`
- Windows: Task Scheduler menjalankan `php artisan schedule:run` setiap 1 menit

Anti-spam: notifikasi dibuat saat part baru masuk status *Segera*/*Lewat jadwal*; part yang tetap
lewat jadwal diingatkan ulang tiap 7 hari; status direset setelah part diganti.

## Jenis kendaraan

Kendaraan bisa berjenis **Mobil** atau **Sepeda motor**. Setiap part berlaku untuk satu jenis (menu Part punya tab per jenis),
jadi dashboard, form catatan, dan pengingat hanya memakai part yang sesuai. Server menolak part yang tidak cocok,
dan jenis kendaraan/part tidak bisa diubah setelah dipakai di catatan.

Master part sepeda motor matic (sampel Honda BeAT eSP 2021; interval perkiraan umum) – aman dijalankan ulang:

```bash
php artisan db:seed --class=MotorcyclePartSeeder
```

## Model 3D

Tanpa file model, dashboard memakai model prosedural bawaan (`frontend/src/components/models/`):
Hyundai Palisade 2026, Toyota Kijang Innova 2012 (mobil) dan Honda BeAT eSP 2021 (sepeda motor).
Kamera viewer menyesuaikan ukuran kendaraan.

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

