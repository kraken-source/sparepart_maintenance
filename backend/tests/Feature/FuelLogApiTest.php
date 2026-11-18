<?php

namespace Tests\Feature;

use App\Models\FuelLog;
use App\Models\FuelType;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FuelLogApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Vehicle $car;

    private FuelType $pertalite;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-18 10:00:00');
        $this->user = $this->actingAsUser();
        $this->car = Vehicle::factory()->for($this->user, 'owner')->create(['odometer' => 10000]);
        $this->pertalite = FuelType::where('name', 'Pertalite')->firstOrFail();
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'vehicle_id' => $this->car->id,
            'fuel_type_id' => $this->pertalite->id,
            'filled_on' => '2026-11-18',
            'odometer' => 10300,
            'liters' => 30,
            'price_per_liter' => 10000,
            'is_full' => true,
        ], $override);
    }

    #[Test]
    public function nilai_ketiga_dihitung_dari_dua_nilai_lainnya(): void
    {
        $this->postJson('/api/fuel-logs', $this->payload())
            ->assertCreated()->assertJsonPath('data.total_cost', 300_000);

        $this->postJson('/api/fuel-logs', $this->payload(['odometer' => 10600, 'liters' => null, 'total_cost' => 255_000]))
            ->assertCreated()->assertJsonPath('data.liters', 25.5);

        $this->postJson('/api/fuel-logs', $this->payload(['odometer' => 10900, 'liters' => 20.25, 'price_per_liter' => null, 'total_cost' => 202_500]))
            ->assertCreated()->assertJsonPath('data.price_per_liter', 10000);
    }

    #[Test]
    public function minimal_dua_dari_tiga_nilai(): void
    {
        $this->postJson('/api/fuel-logs', $this->payload(['price_per_liter' => null]))
            ->assertStatus(422)
            ->assertJsonPath('errors.liters.0', 'Isi minimal dua dari: liter, harga per liter, total bayar.');
    }

    #[Test]
    public function odometer_harus_sejalan_dengan_tanggal(): void
    {
        FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $this->pertalite->id, 'filled_on' => '2026-11-01', 'odometer' => 10000]);
        FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $this->pertalite->id, 'filled_on' => '2026-11-15', 'odometer' => 10800]);

        $this->postJson('/api/fuel-logs', $this->payload(['filled_on' => '2026-11-18', 'odometer' => 10500]))
            ->assertStatus(422)
            ->assertJsonPath('errors.odometer.0', 'Odometer lebih kecil dari pengisian sebelumnya (10.800 km pada 15 Nov 2026).');

        $this->postJson('/api/fuel-logs', $this->payload(['filled_on' => '2026-11-10', 'odometer' => 10900]))
            ->assertStatus(422)
            ->assertJsonPath('errors.odometer.0', 'Odometer lebih besar dari pengisian sesudahnya (10.800 km pada 15 Nov 2026).');

        // Disisipkan di antaranya → boleh
        $this->postJson('/api/fuel-logs', $this->payload(['filled_on' => '2026-11-10', 'odometer' => 10400]))->assertCreated();
    }

    #[Test]
    public function edit_tidak_bertabrakan_dengan_dirinya_sendiri(): void
    {
        $log = FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $this->pertalite->id, 'filled_on' => '2026-11-10', 'odometer' => 10300]);

        $this->putJson("/api/fuel-logs/{$log->id}", $this->payload(['filled_on' => '2026-11-10', 'odometer' => 10250, 'liters' => 28]))
            ->assertOk()->assertJsonPath('data.odometer', 10250)->assertJsonPath('data.total_cost', 280_000);
    }

    #[Test]
    public function jenis_bbm_harus_sesuai_kendaraan_dan_aktif(): void
    {
        $dexlite = FuelType::where('name', 'Dexlite')->firstOrFail();
        $this->postJson('/api/fuel-logs', $this->payload(['fuel_type_id' => $dexlite->id]))
            ->assertStatus(422)
            ->assertJsonPath('errors.fuel_type_id.0', 'Dexlite adalah BBM diesel, sedangkan kendaraan ini memakai bensin.');

        $old = FuelType::factory()->create(['name' => 'Premium', 'is_active' => false]);
        $this->postJson('/api/fuel-logs', $this->payload(['fuel_type_id' => $old->id]))
            ->assertStatus(422)
            ->assertJsonPath('errors.fuel_type_id.0', 'Jenis BBM Premium sudah tidak aktif.');

        // Catatan lama yang memang memakai jenis nonaktif tetap bisa diedit.
        $log = FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $old->id, 'filled_on' => '2026-11-01', 'odometer' => 10000]);
        $this->putJson("/api/fuel-logs/{$log->id}", $this->payload(['fuel_type_id' => $old->id, 'filled_on' => '2026-11-01', 'odometer' => 10000]))->assertOk();
    }

    #[Test]
    public function odometer_kendaraan_ikut_naik_tapi_tidak_turun(): void
    {
        $this->postJson('/api/fuel-logs', $this->payload(['odometer' => 12345]))->assertCreated();
        $this->assertSame(12345, $this->car->fresh()->odometer);

        $this->postJson('/api/fuel-logs', $this->payload(['filled_on' => '2026-11-01', 'odometer' => 11000]))->assertCreated();
        $this->assertSame(12345, $this->car->fresh()->odometer);
    }

    #[Test]
    public function odometer_kendaraan_tidak_bisa_diturunkan_di_bawah_pengisian_terakhir(): void
    {
        FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $this->pertalite->id, 'odometer' => 15000]);

        $this->putJson("/api/vehicles/{$this->car->id}", [
            'plate_number' => $this->car->plate_number, 'brand' => 'Toyota', 'model' => 'Avanza', 'odometer' => 14000,
        ])->assertStatus(422)->assertJsonPath('errors.odometer.0', 'Odometer tidak boleh lebih kecil dari catatan maintenance / pengisian BBM terakhir (15000 km).');
    }

    #[Test]
    public function pemilik_boleh_menghapus_catatannya(): void
    {
        $log = FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $this->pertalite->id]);

        $this->deleteJson("/api/fuel-logs/{$log->id}")->assertNoContent();
        $this->assertModelMissing($log);
    }

    #[Test]
    public function data_bbm_kendaraan_orang_lain_tidak_bisa_diakses(): void
    {
        $other = Vehicle::factory()->create();
        $log = FuelLog::factory()->for($other)->create(['fuel_type_id' => $this->pertalite->id]);

        $this->getJson("/api/fuel-logs?vehicle_id={$other->id}")->assertNotFound();
        $this->putJson("/api/fuel-logs/{$log->id}", $this->payload(['vehicle_id' => $other->id]))->assertNotFound();
        $this->deleteJson("/api/fuel-logs/{$log->id}")->assertNotFound();
        $this->postJson('/api/fuel-logs', $this->payload(['vehicle_id' => $other->id]))
            ->assertStatus(422)->assertJsonValidationErrors('vehicle_id');

        // Admin boleh
        $this->actingAsAdmin();
        $this->getJson("/api/fuel-logs?vehicle_id={$other->id}")->assertOk();
    }

    #[Test]
    public function kelompok_bbm_kendaraan_terkunci_bila_sudah_ada_pengisian(): void
    {
        $vehicle = fn (array $o) => array_merge(['plate_number' => $this->car->plate_number, 'brand' => 'Toyota', 'model' => 'Avanza', 'odometer' => 20000], $o);
        $dexlite = FuelType::where('name', 'Dexlite')->firstOrFail();

        $this->putJson("/api/vehicles/{$this->car->id}", $vehicle(['fuel_group' => 'diesel', 'default_fuel_type_id' => $this->pertalite->id]))
            ->assertStatus(422)->assertJsonPath('errors.default_fuel_type_id.0', 'Pertalite bukan BBM diesel.');
        $this->putJson("/api/vehicles/{$this->car->id}", $vehicle(['fuel_group' => 'diesel', 'default_fuel_type_id' => $dexlite->id, 'tank_capacity' => 55]))
            ->assertOk()->assertJsonPath('data.fuel_group', 'diesel')->assertJsonPath('data.tank_capacity', 55);

        FuelLog::factory()->for($this->car)->create(['fuel_type_id' => $dexlite->id, 'odometer' => 20000]);
        $this->putJson("/api/vehicles/{$this->car->id}", $vehicle(['fuel_group' => 'gasoline', 'default_fuel_type_id' => null]))
            ->assertStatus(422)->assertJsonPath('errors.fuel_group.0', 'Jenis bahan bakar tidak bisa diubah karena sudah ada catatan pengisian.');
    }
}
