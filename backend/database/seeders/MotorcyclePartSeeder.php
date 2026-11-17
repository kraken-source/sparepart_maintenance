<?php

namespace Database\Seeders;

use App\Models\Part;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

/**
 * Master part sepeda motor matic (sampel: Honda BeAT eSP 2021 – berpendingin udara, CVT, tanpa rantai).
 * Interval adalah perkiraan umum; sesuaikan dengan buku servis / rekomendasi bengkel.
 * mesh_name harus sama dengan nama <Part> di model 3D motor (frontend/src/components/models/BeatModel.jsx).
 *
 * Aman dijalankan berulang (firstOrCreate) dan tidak mengubah part yang sudah ada:
 *   php artisan db:seed --class=MotorcyclePartSeeder
 */
class MotorcyclePartSeeder extends Seeder
{
    public function run(): void
    {
        $parts = [
            // [nama, kategori, mesh_name, interval_km, interval_hari]
            ['Oli Mesin', 'Mesin', 'engine_oil', 3000, 90],
            ['Oli Gardan', 'Mesin', 'gear_oil', 8000, null],
            ['Filter Udara', 'Mesin', 'air_filter', 16000, null],
            ['Busi', 'Mesin', 'spark_plug', 8000, null],
            ['V-Belt', 'CVT', 'cvt_belt', 24000, null],
            ['Roller CVT', 'CVT', 'cvt_roller', 24000, null],
            ['Kampas Rem Depan (Cakram)', 'Rem', 'brake_front', 10000, null],
            ['Kampas Rem Belakang (Tromol)', 'Rem', 'brake_rear', 15000, null],
            ['Minyak Rem', 'Rem', 'brake_fluid', null, 730],
            ['Ban Depan', 'Kaki-kaki', 'tire_front', 15000, 1460],
            ['Ban Belakang', 'Kaki-kaki', 'tire_rear', 12000, 1460],
            ['Aki', 'Kelistrikan', 'battery', null, 730],
            ['Lampu Depan', 'Kelistrikan', 'headlight', null, null],
            ['Lampu Belakang', 'Kelistrikan', 'taillight', null, null],
        ];

        foreach ($parts as [$name, $category, $mesh, $km, $days]) {
            Part::firstOrCreate(
                ['vehicle_type' => Vehicle::TYPE_MOTORCYCLE, 'mesh_name' => $mesh],
                ['name' => $name, 'category' => $category, 'interval_km' => $km, 'interval_days' => $days],
            );
        }
    }
}
