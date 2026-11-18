<?php

namespace Database\Seeders;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // User awal untuk development. firstOrCreate: password tidak di-reset saat seed ulang.
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            ['name' => 'Admin', 'password' => env('SEED_ADMIN_PASSWORD', 'password'), 'role' => 'admin'],
        );

        // Master part sepeda motor (terpisah agar bisa dijalankan sendiri di database yang sudah ada).
        $this->call(MotorcyclePartSeeder::class);

        $vehicle = Vehicle::firstOrCreate(
            ['plate_number' => 'B 1234 PLS'],
            [
                'user_id' => $admin->id,
                'type' => Vehicle::TYPE_CAR,
                'brand' => 'Hyundai',
                'model' => 'Palisade',
                'year' => 2024,
                'odometer' => 42500,
                'vehicle_model_id' => VehicleModel::where('builtin_key', 'palisade')->value('id'),
            ],
        );

        // mesh_name harus sama dengan nama mesh di model 3D.
        $parts = [
            ['Oli Mesin & Filter Oli', 'Mesin', 'engine_oil', 10000, 180],
            ['Filter Udara', 'Mesin', 'air_filter', 20000, 365],
            ['Aki', 'Kelistrikan', 'battery', null, 730],
            ['Coolant / Radiator', 'Mesin', 'coolant', 40000, 730],
            ['Wiper', 'Body', 'wiper', null, 365],
            ['Lampu Depan Kiri', 'Kelistrikan', 'headlight_left', null, null],
            ['Lampu Depan Kanan', 'Kelistrikan', 'headlight_right', null, null],
            ['Lampu Belakang Kiri', 'Kelistrikan', 'taillight_left', null, null],
            ['Lampu Belakang Kanan', 'Kelistrikan', 'taillight_right', null, null],
        ];
        foreach (['front_left' => 'Depan Kiri', 'front_right' => 'Depan Kanan', 'rear_left' => 'Belakang Kiri', 'rear_right' => 'Belakang Kanan'] as $key => $label) {
            $parts[] = ["Ban {$label}", 'Kaki-kaki', "tire_{$key}", 40000, 1460];
            $parts[] = ["Kampas Rem {$label}", 'Rem', "brake_{$key}", str_starts_with($key, 'front') ? 30000 : 45000, null];
        }

        $byMesh = [];
        foreach ($parts as [$name, $category, $mesh, $km, $days]) {
            $byMesh[$mesh] = Part::firstOrCreate(
                ['vehicle_type' => Vehicle::TYPE_CAR, 'mesh_name' => $mesh],
                ['name' => $name, 'category' => $category, 'interval_km' => $km, 'interval_days' => $days],
            );
        }

        // Contoh riwayat agar dashboard langsung menampilkan variasi status.
        if ($vehicle->maintenanceRecords()->exists()) {
            return;
        }
        $today = Carbon::today();
        $samples = [
            // [mesh, hari lalu, odometer, merek, biaya, bengkel, catatan]
            ['engine_oil', 400, 22000, 'Hyundai Genuine 5W-30', 1150000, 'Hyundai Sunter', 'Servis berkala 20.000 km'],
            ['engine_oil', 210, 32100, 'Shell Helix Ultra 5W-30', 1250000, 'Hyundai Sunter', 'Servis berkala 30.000 km'],
            ['engine_oil', 30, 41900, 'Hyundai Genuine 5W-30', 1180000, 'Hyundai Sunter', 'Servis berkala 40.000 km'],
            ['air_filter', 210, 32100, 'Hyundai Genuine', 350000, 'Hyundai Sunter', null],
            ['battery', 700, 12000, 'GS Astra Hybrid', 1650000, 'Toko Aki Jaya', 'Aki lama soak'],
            ['wiper', 300, 30000, 'Bosch Aerotwin', 420000, 'Hyundai Sunter', null],
            ['tire_front_left', 500, 5000, 'Michelin Primacy SUV', 2900000, 'Ban Center', null],
            ['tire_front_right', 500, 5000, 'Michelin Primacy SUV', 2900000, 'Ban Center', null],
            ['tire_rear_left', 500, 5000, 'Michelin Primacy SUV', 2900000, 'Ban Center', null],
            ['tire_rear_right', 500, 5000, 'Michelin Primacy SUV', 2900000, 'Ban Center', null],
            ['brake_front_left', 120, 38000, 'Bendix', 900000, 'Hyundai Sunter', 'Kampas tipis'],
            ['brake_front_right', 120, 38000, 'Bendix', 900000, 'Hyundai Sunter', 'Kampas tipis'],
            ['brake_rear_left', 450, 4000, 'Hyundai Genuine', 750000, 'Hyundai Sunter', null],
        ];
        foreach ($samples as [$mesh, $daysAgo, $odo, $brand, $cost, $workshop, $notes]) {
            MaintenanceRecord::create([
                'vehicle_id' => $vehicle->id,
                'part_id' => $byMesh[$mesh]->id,
                'action' => 'replace',
                'service_date' => $today->copy()->subDays($daysAgo),
                'odometer' => $odo,
                'part_brand' => $brand,
                'cost' => $cost,
                'workshop' => $workshop,
                'notes' => $notes,
            ]);
        }
    }
}
