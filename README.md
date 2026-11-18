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

### Sekali saja (persiapan awal)

```bash
# Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite      # PowerShell: New-Item database\database.sqlite -ItemType File
php artisan migrate --seed          # tabel + data contoh Hyundai Palisade

# Frontend
cd ../frontend
npm install
```

### Setiap kali mau menjalankan

Dari folder utama proyek, satu perintah menyalakan backend **dan** frontend:

```bash
npm run dev               # buka http://localhost:5173 · Ctrl+C menghentikan semuanya
npm run dev:schedule      # sama, plus scheduler pengingat jatuh tempo (jam 07:00)
```

- PHP dipilih otomatis: `PHP_BIN` bila diset, jika tidak PHP terbaru di `C:\laragon\bin\php`, terakhir `php` di PATH.
  Ini menghindari PHP lain di PATH (mis. PHP 8.0 dari XAMPP) yang membuat backend gagal jalan.
- Log ditandai `[api]` (Laravel) dan `[web]` (Vite). Bila salah satu berhenti, yang lain ikut dihentikan.
- Bila port 8000 / 5173 sudah terpakai, script berhenti dengan pesan, bukan diam-diam memakai port lain.

Cara manual (dua terminal) tetap bisa: `php artisan serve` di `backend/` dan `npm run dev` di `frontend/`.
Vite meneruskan `/api/*` ke `127.0.0.1:8000`, jadi backend harus berjalan lebih dulu.

## Login, peran & pengguna

Seeder membuat admin development `admin@example.com` dengan password `password`
(ganti lewat `SEED_ADMIN_PASSWORD` di `.env` sebelum seeding). **Ganti password ini sebelum dipakai orang lain.**

| Aksi | Admin | User |
|---|---|---|
| Lihat kendaraan beserta catatan, laporan & notifikasinya | ✅ semua | ✅ milik sendiri |
| Laporan biaya per pemilik (filter pemilik, klik grafik untuk drill-down pemilik → kendaraan) | ✅ | ❌ |
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
# Backend (PHPUnit) – 115 test: usia pakai, API CRUD, lampiran, login, peran & pengguna, kepemilikan, jenis kendaraan,
# pengingat & anti-spam, laporan biaya (termasuk per pemilik), bahan bakar & konsumsi, pesan Bahasa Indonesia
cd backend
php artisan test

# Frontend (Vitest) – 35 test: format tanggal/angka, skala grafik, pesan error, hitung otomatis BBM
cd frontend
npm test
```

Di Windows, jalankan `npm test` dari folder dengan huruf drive kapital (`C:\…`). Bila terminal
berada di `c:\…` (huruf kecil), Vitest bisa gagal dengan *Cannot read properties of undefined (reading 'config')*.

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
Part yang belum pernah dicatat (status *Belum ada data*) tidak memicu notifikasi. Lonceng hanya menampilkan
notifikasi kendaraan yang masih ada dan boleh dilihat user; menghapus kendaraan ikut menghapus notifikasinya.

## Bahan bakar

Menu **Bahan Bakar** mencatat setiap pengisian (tanggal, odometer, jenis BBM, liter / harga / total,
isi penuh atau sebagian). Cukup isi dua dari liter, harga per liter, dan total bayar; yang ketiga dihitung.

Konsumsi (km/L) memakai metode **tangki penuh ke tangki penuh**: jarak antara dua kali isi penuh dibagi
liter yang diisi sesudah isi penuh pertama, termasuk isi sebagian di antaranya. Rata-rata keseluruhan
adalah total km ÷ total liter dari segmen yang valid. Centang *Ada pengisian yang tidak dicatat* untuk
memutus perhitungan bila ada pengisian yang lupa dicatat. Hasilnya tidak disimpan, melainkan dihitung
ulang setiap kali ditampilkan, jadi mengedit atau menghapus catatan lama langsung tercermin
(`app/Services/FuelEconomyService.php`).

- Master **Jenis BBM** (menu Master Data, ubah khusus admin) berisi kelompok bensin / diesel. Kendaraan
  bensin hanya bisa diisi jenis bensin, dst. Jenis yang tidak dijual lagi cukup dinonaktifkan.
- Di data kendaraan: jenis bahan bakar, BBM default (otomatis terpilih), dan kapasitas tangki
  (untuk peringatan salah input liter).
- Odometer pengisian ikut menaikkan odometer kendaraan, sehingga pengingat servis berbasis km ikut akurat.
- Hak akses sama dengan catatan maintenance; pemilik kendaraan juga boleh menghapus catatan BBM-nya.
- Halaman Bahan Bakar punya grafik tren km/L per isi penuh (dengan garis rata-rata), dan Dashboard
  punya kartu **Konsumsi BBM** (klik untuk membuka halaman Bahan Bakar).
- **Laporan Biaya** menggabungkan biaya BBM sebagai kategori *Bahan Bakar* (total, per bulan, per
  kategori, per kendaraan + km/L, per pemilik), plus bagian BBM per jenis dan rincian pengisian.
  Centang *Termasuk BBM* bisa dimatikan untuk melihat biaya maintenance saja. Excel ikut memuat
  sheet **BBM** dan rincian maintenance vs BBM di Ringkasan (Total biaya tetap di sel B8).

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

