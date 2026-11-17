<?php

namespace Tests\Feature;

use App\Models\MaintenanceAttachment;
use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Kendaraan melekat ke pemiliknya: user A tidak bisa melihat / mengubah data user B.
 * Admin melihat semua. Data milik orang lain dijawab 404 agar keberadaannya tidak bocor.
 */
class VehicleOwnershipTest extends TestCase
{
    use RefreshDatabase;

    private User $a;

    private User $b;

    private Vehicle $carA;

    private Vehicle $carB;

    private MaintenanceRecord $recordB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00');
        Storage::fake(MaintenanceAttachment::DISK);

        $this->a = User::factory()->create(['name' => 'Andi']);
        $this->b = User::factory()->create(['name' => 'Budi']);
        $this->carA = Vehicle::factory()->create(['user_id' => $this->a->id, 'plate_number' => 'B 1 AAA', 'odometer' => 40000]);
        $this->carB = Vehicle::factory()->create(['user_id' => $this->b->id, 'plate_number' => 'B 2 BBB', 'odometer' => 60000]);
        $part = Part::factory()->create(['interval_km' => 10000, 'interval_days' => null]);
        MaintenanceRecord::factory()->for($this->carA)->for($part)->create(['cost' => 100_000, 'odometer' => 39000, 'service_date' => '2026-10-01']);
        $this->recordB = MaintenanceRecord::factory()->for($this->carB)->for($part)->create(['cost' => 900_000, 'odometer' => 41000, 'service_date' => '2026-10-01']);
    }

    #[Test]
    public function daftar_kendaraan_hanya_milik_sendiri(): void
    {
        $this->actingAsUser($this->a);

        $this->getJson('/api/vehicles')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.plate_number', 'B 1 AAA');
    }

    #[Test]
    public function kendaraan_orang_lain_tidak_ditemukan(): void
    {
        $this->actingAsUser($this->a);
        $id = $this->carB->id;

        $this->getJson("/api/vehicles/{$id}")->assertNotFound()->assertJsonPath('message', 'Data tidak ditemukan.');
        $this->getJson("/api/vehicles/{$id}/parts-status")->assertNotFound();
        $this->getJson("/api/vehicles/{$id}/summary")->assertNotFound();
        $this->deleteJson("/api/vehicles/{$id}")->assertNotFound();

        // Edit kendaraan orang lain: 404 SEBELUM validasi → batas odometer milik B tidak bocor
        $this->putJson("/api/vehicles/{$id}", ['plate_number' => 'B 2 BBB', 'brand' => 'x', 'model' => 'y', 'odometer' => 1])
            ->assertNotFound()
            ->assertJsonMissingPath('errors');

        $this->assertModelExists($this->carB);
        $this->assertSame(60000, $this->carB->fresh()->odometer);
    }

    #[Test]
    public function catatan_dan_lampiran_orang_lain_tidak_bisa_diakses(): void
    {
        $this->actingAsUser($this->b);
        $this->post("/api/maintenance-records/{$this->recordB->id}/attachments", ['files' => [UploadedFile::fake()->image('nota.png', 10, 10)]], ['Accept' => 'application/json'])->assertCreated();
        $attachment = MaintenanceAttachment::first();

        $this->actingAsUser($this->a);
        $ids = collect($this->getJson('/api/maintenance-records?per_page=100')->assertOk()->json('data'))->pluck('vehicle_id')->unique()->values()->all();
        $this->assertSame([$this->carA->id], $ids, 'Daftar catatan hanya dari kendaraan sendiri');
        $this->getJson("/api/maintenance-records?vehicle_id={$this->carB->id}")->assertJsonPath('total', 0);

        $this->getJson("/api/maintenance-records/{$this->recordB->id}")->assertNotFound();
        $this->putJson("/api/maintenance-records/{$this->recordB->id}", [
            'vehicle_id' => $this->carA->id, 'part_id' => $this->recordB->part_id, 'action' => 'replace', 'service_date' => '2026-11-01', 'odometer' => 1,
        ])->assertNotFound();
        $this->get("/api/attachments/{$attachment->id}", ['Accept' => 'application/json'])->assertNotFound();
        $this->deleteJson("/api/attachments/{$attachment->id}")->assertNotFound();
        $this->post("/api/maintenance-records/{$this->recordB->id}/attachments", ['files' => [UploadedFile::fake()->image('x.png', 10, 10)]], ['Accept' => 'application/json'])->assertNotFound();

        $this->assertDatabaseCount('maintenance_attachments', 1);
    }

    #[Test]
    public function tidak_bisa_mencatat_maintenance_untuk_kendaraan_orang_lain(): void
    {
        $this->actingAsUser($this->a);

        $this->postJson('/api/maintenance-records', [
            'vehicle_id' => $this->carB->id, 'part_id' => $this->recordB->part_id, 'action' => 'inspect', 'service_date' => '2026-11-17', 'odometer' => 99999,
        ])->assertStatus(422)->assertJsonPath('errors.vehicle_id.0', 'Kendaraan yang dipilih tidak ditemukan.');

        $this->assertSame(60000, $this->carB->fresh()->odometer);
    }

    #[Test]
    public function laporan_biaya_hanya_kendaraan_sendiri(): void
    {
        $this->actingAsUser($this->a);

        $d = $this->getJson('/api/reports/costs?from=2026-01-01&to=2026-12-31')->assertOk()->json('data');
        $this->assertSame(100_000, $d['summary']['total']);
        $this->assertSame(['B 1 AAA'], array_column($d['by_vehicle'], 'plate_number'));

        $this->getJson("/api/reports/costs?vehicle_id={$this->carB->id}")->assertStatus(422);
        $this->get("/api/reports/costs/export?vehicle_id={$this->carB->id}", ['Accept' => 'application/json'])->assertStatus(422);
    }

    #[Test]
    public function user_menambah_kendaraan_selalu_jadi_miliknya_sendiri(): void
    {
        $this->actingAsUser($this->a);

        // user_id dari user biasa diabaikan (tidak bisa membuatkan kendaraan atas nama orang lain)
        $this->postJson('/api/vehicles', ['plate_number' => 'B 3 CCC', 'brand' => 'Honda', 'model' => 'Jazz', 'odometer' => 1000, 'user_id' => $this->b->id])
            ->assertCreated()
            ->assertJsonPath('data.user_id', $this->a->id);

        // Mengedit kendaraan sendiri boleh, tapi tidak bisa memindahkan pemilik
        $this->putJson("/api/vehicles/{$this->carA->id}", ['plate_number' => 'B 1 AAA', 'brand' => 'Toyota', 'model' => 'Avanza', 'odometer' => 41000, 'user_id' => $this->b->id])
            ->assertOk()
            ->assertJsonPath('data.user_id', $this->a->id);
    }

    #[Test]
    public function admin_melihat_semua_dan_bisa_memindahkan_pemilik(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/vehicles')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.owner.name', 'Budi');
        $this->getJson("/api/vehicles?owner_id={$this->b->id}")->assertJsonCount(1, 'data');
        $this->getJson("/api/maintenance-records/{$this->recordB->id}")->assertOk();
        $this->assertSame(1_000_000, $this->getJson('/api/reports/costs?from=2026-01-01&to=2026-12-31')->json('data.summary.total'));

        $this->putJson("/api/vehicles/{$this->carB->id}", ['plate_number' => 'B 2 BBB', 'brand' => 'x', 'model' => 'y', 'odometer' => 60000, 'user_id' => $this->a->id])
            ->assertOk()->assertJsonPath('data.owner.name', 'Andi');

        $this->postJson('/api/vehicles', ['plate_number' => 'B 4 DDD', 'brand' => 'x', 'model' => 'y', 'odometer' => 1, 'user_id' => $this->b->id])
            ->assertCreated()->assertJsonPath('data.user_id', $this->b->id);
    }

    #[Test]
    public function notifikasi_hanya_ke_pemilik_dan_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $inactiveAdmin = User::factory()->admin()->inactive()->create();

        app(DueReminderService::class)->check(); // kendaraan B lewat jadwal (41.000 + 10.000 < 60.000)

        $this->assertCount(1, $this->b->fresh()->notifications, 'Pemilik B menerima');
        $this->assertCount(1, $admin->fresh()->notifications, 'Admin menerima');
        $this->assertCount(0, $this->a->fresh()->notifications, 'User lain tidak menerima');
        $this->assertCount(0, $inactiveAdmin->fresh()->notifications, 'Admin nonaktif tidak menerima');
    }

    #[Test]
    public function user_yang_masih_punya_kendaraan_tidak_bisa_dihapus(): void
    {
        $this->actingAsAdmin();

        $this->deleteJson("/api/users/{$this->b->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Budi masih memiliki 1 kendaraan. Pindahkan pemilik kendaraannya terlebih dahulu, atau nonaktifkan akun ini.');
        $this->assertModelExists($this->b);

        $this->getJson('/api/users')->assertOk()->assertJsonFragment(['name' => 'Budi', 'vehicles_count' => 1]);
    }
}
