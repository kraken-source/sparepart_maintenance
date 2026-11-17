<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\Vehicle;
use Database\Seeders\MotorcyclePartSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Jenis kendaraan (mobil / sepeda motor) dan part per jenis.
 */
class VehicleTypeTest extends TestCase
{
    use RefreshDatabase;

    private Part $carOil;

    private Part $bikeOil;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00');
        // Nama mesh sama di kedua jenis, interval berbeda
        $this->carOil = Part::factory()->create(['vehicle_type' => 'car', 'name' => 'Oli Mobil', 'mesh_name' => 'engine_oil', 'interval_km' => 10000]);
        $this->bikeOil = Part::factory()->create(['vehicle_type' => 'motorcycle', 'name' => 'Oli Motor', 'mesh_name' => 'engine_oil', 'interval_km' => 3000]);
    }

    #[Test]
    public function kendaraan_baru_default_mobil_dan_bisa_sepeda_motor(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/vehicles', ['plate_number' => 'B 1 CAR', 'brand' => 'x', 'model' => 'y', 'odometer' => 1])
            ->assertCreated()->assertJsonPath('data.type', 'car');
        $this->postJson('/api/vehicles', ['type' => 'motorcycle', 'plate_number' => 'B 2 MTR', 'brand' => 'Honda', 'model' => 'BeAT', 'odometer' => 1])
            ->assertCreated()->assertJsonPath('data.type', 'motorcycle');
        $this->postJson('/api/vehicles', ['type' => 'pesawat', 'plate_number' => 'B 3 X', 'brand' => 'x', 'model' => 'y', 'odometer' => 1])
            ->assertStatus(422)->assertJsonPath('errors.type.0', 'Jenis kendaraan yang dipilih tidak valid.');
    }

    #[Test]
    public function status_part_hanya_menampilkan_part_sesuai_jenis(): void
    {
        $me = $this->actingAsUser();
        $bike = Vehicle::factory()->create(['user_id' => $me->id, 'type' => 'motorcycle']);
        $car = Vehicle::factory()->create(['user_id' => $me->id, 'type' => 'car']);

        $this->assertSame(['Oli Motor'], array_column($this->getJson("/api/vehicles/{$bike->id}/parts-status")->json('data'), 'name'));
        $this->assertSame(['Oli Mobil'], array_column($this->getJson("/api/vehicles/{$car->id}/parts-status")->json('data'), 'name'));
    }

    #[Test]
    public function part_harus_sesuai_jenis_kendaraan_di_catatan(): void
    {
        $me = $this->actingAsUser();
        $bike = Vehicle::factory()->create(['user_id' => $me->id, 'type' => 'motorcycle']);
        $base = ['vehicle_id' => $bike->id, 'action' => 'replace', 'service_date' => '2026-11-17', 'odometer' => 12000];

        $this->postJson('/api/maintenance-records', $base + ['part_id' => $this->carOil->id])
            ->assertStatus(422)
            ->assertJsonPath('errors.part_id.0', 'Part ini untuk mobil, tidak sesuai dengan jenis kendaraan yang dipilih.');

        $this->postJson('/api/maintenance-records', $base + ['part_id' => $this->bikeOil->id])
            ->assertCreated()
            ->assertJsonPath('data.next_service.next_km', 15000); // interval oli motor 3.000 km
    }

    #[Test]
    public function jenis_kendaraan_tidak_bisa_diubah_bila_sudah_ada_catatan(): void
    {
        $me = $this->actingAsUser();
        $car = Vehicle::factory()->create(['user_id' => $me->id, 'type' => 'car', 'plate_number' => 'B 1 AAA']);
        $payload = ['type' => 'motorcycle', 'plate_number' => 'B 1 AAA', 'brand' => 'x', 'model' => 'y', 'odometer' => 50000];

        MaintenanceRecord::factory()->for($car)->for($this->carOil)->create();
        $this->putJson("/api/vehicles/{$car->id}", $payload)
            ->assertStatus(422)
            ->assertJsonPath('errors.type.0', 'Jenis kendaraan tidak bisa diubah karena sudah ada catatan maintenance.');

        // Tanpa catatan boleh (mis. salah pilih saat menambah)
        $new = Vehicle::factory()->create(['user_id' => $me->id, 'type' => 'car', 'plate_number' => 'B 2 BBB']);
        $this->putJson("/api/vehicles/{$new->id}", ['plate_number' => 'B 2 BBB'] + $payload)->assertOk()->assertJsonPath('data.type', 'motorcycle');
    }

    #[Test]
    public function nama_mesh_unik_per_jenis_dan_jenis_part_terkunci_bila_dipakai(): void
    {
        $this->actingAsAdmin();

        // engine_oil sudah ada untuk motor → ganda ditolak; tapi jenis lain boleh punya nama sama
        $this->postJson('/api/parts', ['vehicle_type' => 'motorcycle', 'name' => 'Oli 2', 'category' => 'Mesin', 'mesh_name' => 'engine_oil'])
            ->assertStatus(422)->assertJsonPath('errors.mesh_name.0', 'Nama mesh 3D sudah digunakan.');

        MaintenanceRecord::factory()->for($this->carOil)->create();
        $this->putJson("/api/parts/{$this->carOil->id}", ['vehicle_type' => 'motorcycle', 'name' => 'Oli Mobil', 'category' => 'Mesin', 'mesh_name' => 'oli_x'])
            ->assertStatus(422)
            ->assertJsonPath('errors.vehicle_type.0', 'Jenis kendaraan tidak bisa diubah karena part ini sudah dipakai di catatan maintenance.');
    }

    #[Test]
    public function filter_part_per_jenis(): void
    {
        $this->actingAsUser();

        $this->getJson('/api/parts?vehicle_type=motorcycle')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Oli Motor');
        $this->getJson('/api/parts')->assertOk()->assertJsonCount(2, 'data');
    }

    #[Test]
    public function seeder_part_motor_lengkap_dan_aman_dijalankan_ulang(): void
    {
        $this->seed(MotorcyclePartSeeder::class);
        $this->seed(MotorcyclePartSeeder::class);

        $motor = Part::forType('motorcycle')->pluck('mesh_name')->sort()->values()->all();
        $this->assertSame([
            'air_filter', 'battery', 'brake_fluid', 'brake_front', 'brake_rear', 'cvt_belt', 'cvt_roller',
            'engine_oil', 'gear_oil', 'headlight', 'spark_plug', 'taillight', 'tire_front', 'tire_rear',
        ], $motor);
        $this->assertSame('Oli Motor', $this->bikeOil->fresh()->name, 'Part yang sudah ada tidak ditimpa');
    }
}
