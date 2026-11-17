<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Pengingat jatuh tempo + aturan anti-spam.
 */
class DueReminderTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Vehicle $vehicle;

    private Part $oil;

    private Part $tire;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 07:00:00');
        $this->user = User::factory()->create();
        $this->vehicle = Vehicle::factory()->create(['plate_number' => 'B 1 TES', 'odometer' => 42500, 'user_id' => $this->user->id]);
        $this->oil = Part::factory()->create(['name' => 'Oli', 'mesh_name' => 'engine_oil', 'interval_km' => 10000, 'interval_days' => null]);
        $this->tire = Part::factory()->create(['name' => 'Ban', 'mesh_name' => 'tire_fl', 'interval_km' => 40000, 'interval_days' => null]);

        // Oli lewat jadwal (32.000 + 10.000 < 42.500), ban segera (5.000 + 40.000 - 42.500 = 2.500 = 6%)
        MaintenanceRecord::factory()->for($this->vehicle)->for($this->oil)->create(['odometer' => 32000, 'service_date' => '2026-01-01']);
        MaintenanceRecord::factory()->for($this->vehicle)->for($this->tire)->create(['odometer' => 5000, 'service_date' => '2025-01-01']);
    }

    private function check(?string $at = null): int
    {
        return app(DueReminderService::class)->check(null, $at ? Carbon::parse($at) : null);
    }

    /**
     * Jalankan pemeriksaan dan kembalikan item dari notifikasi yang BARU dibuat.
     * (Waktu dibekukan di test sehingga created_at sama; jangan andalkan latest().)
     */
    private function checkAndGetNewItems(?string $at = null): array
    {
        $before = $this->user->notifications()->pluck('id');
        $this->assertSame(1, $this->check($at), 'Harus tepat satu notifikasi baru');
        $new = $this->user->notifications()->whereNotIn('id', $before)->sole();

        return collect($new->data['items'])->mapWithKeys(fn ($i) => [$i['name'] => $i])->all();
    }

    #[Test]
    public function pemeriksaan_pertama_membuat_satu_notifikasi_per_kendaraan(): void
    {
        $this->assertSame(1, $this->check());

        $n = $this->user->notifications()->first();
        $this->assertSame('B 1 TES: 1 part lewat jadwal, 1 part segera diganti', $n->data['title']);
        $this->assertSame('overdue', $n->data['level']);
        $this->assertSame('Oli', $n->data['items'][0]['name'], 'Yang paling mendesak di atas');
        $this->assertSame('Lewat 500 km', $n->data['items'][0]['detail']);
    }

    #[Test]
    public function tidak_ada_notifikasi_ulang_untuk_kondisi_yang_sama(): void
    {
        $this->check();
        $this->assertSame(0, $this->check(), 'Diperiksa lagi di hari yang sama');
        $this->assertSame(0, $this->check('2026-11-20 07:00'), '3 hari kemudian');
        $this->assertCount(1, $this->user->fresh()->notifications);
    }

    #[Test]
    public function part_lewat_jadwal_diingatkan_ulang_setelah_7_hari(): void
    {
        $this->check();
        $items = $this->checkAndGetNewItems('2026-11-24 07:00');

        $this->assertSame(['Oli'], array_keys($items), 'Ban yang masih "segera" tidak diulang');
        $this->assertTrue($items['Oli']['reminder']);
    }

    #[Test]
    public function naik_dari_segera_ke_lewat_jadwal_langsung_diberitahu(): void
    {
        $this->check();
        $this->vehicle->update(['odometer' => 46000]); // ban: 5.000 + 40.000 < 46.000

        $items = $this->checkAndGetNewItems();
        $this->assertSame(['Ban'], array_keys($items), 'Oli sudah diberitahu sebelumnya, tidak diulang');
        $this->assertSame('overdue', $items['Ban']['status']);
    }

    #[Test]
    public function setelah_part_diganti_status_pengingat_direset(): void
    {
        $this->check();
        MaintenanceRecord::factory()->for($this->vehicle)->for($this->oil)->create(['odometer' => 42500, 'service_date' => '2026-11-17']);

        $this->assertSame(0, $this->check('2026-11-24 07:00'), 'Oli sudah diganti, tidak diingatkan lagi');
        $this->assertDatabaseMissing('part_alert_states', ['part_id' => $this->oil->id]);
    }

    #[Test]
    public function menyimpan_catatan_lewat_api_langsung_memicu_pemeriksaan(): void
    {
        $this->actingAsUser($this->user);

        $this->postJson('/api/maintenance-records', [
            'vehicle_id' => $this->vehicle->id, 'part_id' => $this->tire->id, 'action' => 'inspect',
            'service_date' => '2026-11-17', 'odometer' => 42500,
        ])->assertCreated();

        $this->assertCount(1, $this->user->fresh()->notifications);
    }

    #[Test]
    public function api_notifikasi_daftar_tandai_dibaca_dan_periksa_sekarang(): void
    {
        $this->actingAsUser($this->user);

        $this->postJson('/api/notifications/check')->assertOk()->assertJsonPath('vehicles_notified', 1);
        $this->postJson('/api/notifications/check')->assertOk()->assertJsonPath('vehicles_notified', 0);

        $list = $this->getJson('/api/notifications')->assertOk()->assertJsonPath('unread_count', 1);
        $id = $list->json('data.0.id');

        $this->postJson("/api/notifications/{$id}/read")->assertNoContent();
        $this->getJson('/api/notifications')->assertJsonPath('unread_count', 0);
    }

    #[Test]
    public function user_tidak_bisa_menandai_notifikasi_user_lain(): void
    {
        $this->check();
        $other = User::factory()->create();
        $foreignId = $this->user->notifications()->first()->id;

        $this->actingAsUser($other);
        $this->postJson("/api/notifications/{$foreignId}/read")->assertNotFound();
        $this->assertNull($this->user->notifications()->first()->read_at);
    }
}
