<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class MaintenanceRecordApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Vehicle $vehicle;

    private Part $part;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00:00');
        $this->user = $this->actingAsUser();
        $this->vehicle = Vehicle::factory()->create(['odometer' => 40000, 'user_id' => $this->user->id]);
        $this->part = Part::factory()->create(['interval_km' => 10000, 'interval_days' => 180]);
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'vehicle_id' => $this->vehicle->id, 'part_id' => $this->part->id, 'action' => 'replace',
            'service_date' => '2026-11-10', 'odometer' => 42000, 'cost' => 750000,
        ], $override);
    }

    #[Test]
    public function catatan_baru_menaikkan_odometer_kendaraan_tapi_tidak_menurunkannya(): void
    {
        $this->postJson('/api/maintenance-records', $this->payload(['odometer' => 42000]))->assertCreated();
        $this->assertSame(42000, $this->vehicle->fresh()->odometer);

        $this->postJson('/api/maintenance-records', $this->payload(['odometer' => 30000, 'service_date' => '2025-01-01']))->assertCreated();
        $this->assertSame(42000, $this->vehicle->fresh()->odometer);
    }

    #[Test]
    public function jadwal_ganti_berikutnya_dihitung_dari_usia_pakai(): void
    {
        $this->postJson('/api/maintenance-records', $this->payload(['life_km' => 5000, 'life_months' => 6]))
            ->assertCreated()
            ->assertJsonPath('data.next_service.source', 'record')
            ->assertJsonPath('data.next_service.next_km', 47000)
            ->assertJsonPath('data.next_service.next_date', '2027-05-10');
    }

    #[Test]
    public function usia_pakai_dibuang_untuk_tindakan_selain_ganti(): void
    {
        $this->postJson('/api/maintenance-records', $this->payload(['action' => 'inspect', 'life_km' => 5000, 'life_months' => 6]))
            ->assertCreated()
            ->assertJsonPath('data.life_km', null)
            ->assertJsonPath('data.life_months', null)
            ->assertJsonPath('data.next_service', null);
    }

    #[Test]
    public function tanggal_servis_disimpan_tanpa_jam(): void
    {
        // Regresi: format campuran "Y-m-d" vs "Y-m-d H:i:s" membuat laporan melewatkan catatan di hari terakhir.
        $this->postJson('/api/maintenance-records', $this->payload(['service_date' => '2026-11-10T08:30:00']))->assertCreated();

        $this->assertSame('2026-11-10', DB::table('maintenance_records')->value('service_date'));
    }

    #[Test]
    public function penggantian_lama_ditandai_sudah_diganti(): void
    {
        $old = MaintenanceRecord::factory()->for($this->vehicle)->for($this->part)->create(['service_date' => '2026-01-01']);
        $new = MaintenanceRecord::factory()->for($this->vehicle)->for($this->part)->create(['service_date' => '2026-06-01']);
        $otherVehicle = MaintenanceRecord::factory()->for($this->part)
            ->for(Vehicle::factory()->create(['user_id' => $this->user->id]))
            ->create(['service_date' => '2026-01-01']);

        $rows = collect($this->getJson('/api/maintenance-records?per_page=50')->assertOk()->json('data'))->keyBy('id');

        $this->assertTrue($rows[$old->id]['superseded']);
        $this->assertFalse($rows[$new->id]['superseded']);
        $this->assertFalse($rows[$otherVehicle->id]['superseded'], 'Kendaraan lain tidak terpengaruh');
    }

    #[Test]
    public function validasi_wajib_dan_tanggal_masa_depan(): void
    {
        $this->postJson('/api/maintenance-records', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['vehicle_id', 'part_id', 'action', 'service_date', 'odometer']);

        $this->postJson('/api/maintenance-records', $this->payload(['service_date' => '2026-11-18']))
            ->assertStatus(422)
            ->assertJsonPath('errors.service_date.0', 'Tanggal servis tidak boleh melebihi hari ini.');

        $this->postJson('/api/maintenance-records', $this->payload(['life_months' => 0, 'cost' => -1, 'action' => 'buang']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['life_months', 'cost', 'action']);
    }

    #[Test]
    public function filter_dan_pencarian(): void
    {
        $other = Part::factory()->create(['name' => 'Kampas Rem']);
        MaintenanceRecord::factory()->for($this->vehicle)->for($this->part)->create(['workshop' => 'Auto2000']);
        MaintenanceRecord::factory()->for($this->vehicle)->for($other)->create(['workshop' => 'Bengkel Jaya']);
        MaintenanceRecord::factory()->for($other)->create(); // kendaraan lain

        $this->getJson("/api/maintenance-records?vehicle_id={$this->vehicle->id}")->assertJsonPath('total', 2);
        $this->getJson("/api/maintenance-records?vehicle_id={$this->vehicle->id}&q=auto2000")->assertJsonPath('total', 1);
        $this->getJson("/api/maintenance-records?vehicle_id={$this->vehicle->id}&q=kampas")->assertJsonPath('total', 1);
    }

    #[Test]
    public function status_part_kendaraan_untuk_dashboard(): void
    {
        MaintenanceRecord::factory()->for($this->vehicle)->for($this->part)->create(['service_date' => '2026-01-01', 'odometer' => 30000]);
        $neverServiced = Part::factory()->create();

        $parts = collect($this->getJson("/api/vehicles/{$this->vehicle->id}/parts-status")->assertOk()->json('data'))->keyBy('id');

        $this->assertSame('overdue', $parts[$this->part->id]['status']); // 30.000 + 10.000 < 40.000
        $this->assertSame('unknown', $parts[$neverServiced->id]['status']);
        $this->assertSame(1, $parts[$this->part->id]['record_count']);
    }
}
