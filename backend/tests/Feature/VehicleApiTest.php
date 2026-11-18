<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Vehicle;
use App\Models\VehicleModel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class VehicleApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsAdmin();
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'plate_number' => 'B 1822 WW', 'brand' => 'Toyota', 'model' => 'Kijang Innova', 'year' => 2012,
            'odometer' => 150000, 'vehicle_model_id' => VehicleModel::where('builtin_key', 'innova')->value('id'),
        ], $override);
    }

    #[Test]
    public function tambah_kendaraan_dan_plat_dinormalisasi(): void
    {
        $this->postJson('/api/vehicles', $this->payload(['plate_number' => '  b   1822  ww ']))
            ->assertCreated()
            ->assertJsonPath('data.plate_number', 'B 1822 WW')
            ->assertJsonPath('data.vehicle_model.builtin_key', 'innova');
    }

    #[Test]
    public function plat_nomor_tidak_boleh_ganda(): void
    {
        Vehicle::factory()->create(['plate_number' => 'B 1822 WW']);

        $this->postJson('/api/vehicles', $this->payload(['plate_number' => 'b 1822 ww']))
            ->assertStatus(422)
            ->assertJsonPath('errors.plate_number.0', 'Plat nomor sudah digunakan.');
    }

    #[Test]
    public function edit_boleh_memakai_plat_sendiri(): void
    {
        $v = Vehicle::factory()->create(['plate_number' => 'B 1822 WW']);

        $this->putJson("/api/vehicles/{$v->id}", $this->payload(['model' => 'Innova Venturer']))
            ->assertOk()
            ->assertJsonPath('data.model', 'Innova Venturer');
    }

    #[Test]
    public function odometer_tidak_boleh_di_bawah_catatan_terakhir(): void
    {
        $v = Vehicle::factory()->create(['odometer' => 50000]);
        MaintenanceRecord::factory()->for($v)->create(['odometer' => 48000]);

        $this->putJson("/api/vehicles/{$v->id}", $this->payload(['plate_number' => $v->plate_number, 'odometer' => 47000]))
            ->assertStatus(422)
            ->assertJsonPath('errors.odometer.0', 'Odometer tidak boleh lebih kecil dari catatan maintenance / pengisian BBM terakhir (48000 km).');
    }

    #[Test]
    public function kendaraan_dengan_riwayat_tidak_bisa_dihapus(): void
    {
        $v = Vehicle::factory()->create();
        MaintenanceRecord::factory()->for($v)->create();

        $this->deleteJson("/api/vehicles/{$v->id}")->assertStatus(422);
        $this->assertModelExists($v);
    }

    #[Test]
    public function kendaraan_tanpa_riwayat_bisa_dihapus(): void
    {
        $v = Vehicle::factory()->create();

        $this->deleteJson("/api/vehicles/{$v->id}")->assertNoContent();
        $this->assertModelMissing($v);
    }

    #[Test]
    public function daftar_kendaraan_menyertakan_jumlah_catatan(): void
    {
        $v = Vehicle::factory()->create();
        MaintenanceRecord::factory()->count(3)->for($v)->create();

        $this->getJson('/api/vehicles')->assertOk()->assertJsonPath('data.0.maintenance_records_count', 3);
    }
}
