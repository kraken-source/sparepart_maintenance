<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Vehicle;
use App\Notifications\VehicleMaintenanceDue;
use Database\Seeders\MotorcyclePartSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Lonceng notifikasi hanya menampilkan kendaraan yang masih ada dan masih boleh dilihat.
 * Regresi: notifikasi kendaraan uji yang sudah dihapus tetap muncul (terlihat seperti Beat milik user).
 */
class NotificationCleanupTest extends TestCase
{
    use RefreshDatabase;

    private function notify(Vehicle $vehicle, User ...$users): void
    {
        Notification::send($users, new VehicleMaintenanceDue($vehicle, [[
            'part_id' => 1, 'mesh_name' => 'engine_oil', 'name' => 'Oli Mesin', 'status' => 'overdue', 'detail' => 'Lewat 1.500 km', 'reminder' => false,
        ]]));
    }

    #[Test]
    public function kendaraan_tanpa_catatan_tidak_menghasilkan_notifikasi(): void
    {
        $this->seed(MotorcyclePartSeeder::class);
        $admin = $this->actingAsAdmin();
        Vehicle::factory()->for($admin, 'owner')->create(['type' => 'motorcycle', 'odometer' => 5000]);

        $this->postJson('/api/notifications/check')->assertOk()->assertJsonPath('vehicles_notified', 0);
        $this->assertSame(0, $admin->notifications()->count());
    }

    #[Test]
    public function notifikasi_ikut_terhapus_bersama_kendaraannya(): void
    {
        $admin = $this->actingAsAdmin();
        $bike = Vehicle::factory()->for($admin, 'owner')->create(['plate_number' => 'ZZ 2021 BET']);
        $keep = Vehicle::factory()->for($admin, 'owner')->create();
        $this->notify($bike, $admin);
        $this->notify($keep, $admin);

        $this->deleteJson("/api/vehicles/{$bike->id}")->assertNoContent();

        $this->assertSame(1, $admin->notifications()->count());
        $this->getJson('/api/notifications')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.data.vehicle_id', $keep->id)
            ->assertJsonPath('unread_count', 1);
    }

    #[Test]
    public function kendaraan_yang_dipindah_ke_pemilik_lain_hilang_dari_lonceng_pemilik_lama(): void
    {
        $andi = User::factory()->create();
        $budi = User::factory()->create();
        $car = Vehicle::factory()->for($andi, 'owner')->create();
        $this->notify($car, $andi);

        $car->update(['user_id' => $budi->id]);

        $this->actingAsUser($andi);
        $id = $andi->notifications()->value('id');
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('unread_count', 0);
        $this->postJson("/api/notifications/{$id}/read")->assertNotFound();
    }

    #[Test]
    public function migration_membersihkan_notifikasi_kendaraan_yang_sudah_tidak_ada(): void
    {
        $admin = User::factory()->admin()->create();
        $car = Vehicle::factory()->for($admin, 'owner')->create();
        $this->notify($car, $admin);
        $orphan = Vehicle::factory()->for($admin, 'owner')->create();
        $this->notify($orphan, $admin);
        DB::table('vehicles')->where('id', $orphan->id)->delete(); // tanpa event, seperti data lama

        (require database_path('migrations/2026_11_19_000002_remove_orphan_notifications.php'))->up();

        $this->assertSame([$car->id], $admin->notifications()->get()->pluck('data.vehicle_id')->all());
    }
}
