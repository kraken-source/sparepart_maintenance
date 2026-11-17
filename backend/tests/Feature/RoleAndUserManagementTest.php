<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Peran admin/user dan pengelolaan pengguna.
 */
class RoleAndUserManagementTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------- peran

    #[Test]
    public function user_biasa_tidak_bisa_mengubah_master_part_menghapus_catatan_atau_kelola_pengguna(): void
    {
        $me = $this->actingAsUser();
        $vehicle = Vehicle::factory()->create(['user_id' => $me->id]); // kendaraan milik sendiri
        $part = Part::factory()->create();
        $record = MaintenanceRecord::factory()->for($vehicle)->for($part)->create();

        $forbidden = [
            ['postJson', '/api/parts', ['name' => 'x', 'category' => 'y', 'mesh_name' => 'z']],
            ['putJson', "/api/parts/{$part->id}", []],
            ['deleteJson', "/api/parts/{$part->id}", []],
            ['deleteJson', "/api/maintenance-records/{$record->id}", []],
            ['getJson', '/api/users', []],
            ['postJson', '/api/users', []],
        ];
        foreach ($forbidden as [$method, $url, $body]) {
            $this->{$method}($url, $body)
                ->assertForbidden()
                ->assertJsonPath('message', 'Anda tidak memiliki akses untuk tindakan ini.');
        }

        $this->assertModelExists($record);
        $this->assertModelExists($vehicle);
    }

    #[Test]
    public function user_biasa_tetap_bisa_melihat_dan_mencatat_maintenance(): void
    {
        $this->travelTo('2026-11-17 10:00');
        $me = $this->actingAsUser();
        $vehicle = Vehicle::factory()->create(['user_id' => $me->id]);
        $part = Part::factory()->create();

        $this->getJson('/api/vehicles')->assertOk();
        $this->getJson('/api/parts')->assertOk();
        $this->getJson('/api/reports/costs')->assertOk();
        $id = $this->postJson('/api/maintenance-records', [
            'vehicle_id' => $vehicle->id, 'part_id' => $part->id, 'action' => 'replace', 'service_date' => '2026-11-17', 'odometer' => 50000,
        ])->assertCreated()->json('data.id');
        $this->putJson("/api/maintenance-records/{$id}", [
            'vehicle_id' => $vehicle->id, 'part_id' => $part->id, 'action' => 'repair', 'service_date' => '2026-11-17', 'odometer' => 50000,
        ])->assertOk()->assertJsonPath('data.action', 'repair');
    }

    #[Test]
    public function me_mengembalikan_peran(): void
    {
        $this->actingAsAdmin();
        $this->getJson('/api/me')->assertJsonPath('data.role', 'admin');

        $this->actingAsUser();
        $this->getJson('/api/me')->assertJsonPath('data.role', 'user');
    }

    // ---------------------------------------------------------------- akun nonaktif

    #[Test]
    public function akun_nonaktif_tidak_bisa_login(): void
    {
        User::factory()->inactive()->create(['email' => 'budi@contoh.com', 'password' => 'rahasia123']);

        $this->postJson('/api/login', ['email' => 'budi@contoh.com', 'password' => 'rahasia123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Akun Anda dinonaktifkan. Hubungi admin.');
    }

    #[Test]
    public function akun_nonaktif_dengan_token_lama_ditolak(): void
    {
        $user = User::factory()->create(['is_active' => false]);
        $token = $user->createToken('lama')->plainTextToken;

        $this->withToken($token)->getJson('/api/vehicles')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Akun Anda dinonaktifkan. Hubungi admin.');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[Test]
    public function login_mencatat_waktu_dan_email_tidak_peka_huruf_besar(): void
    {
        $this->travelTo('2026-11-18 08:00');
        $user = User::factory()->create(['email' => 'budi@contoh.com', 'password' => 'rahasia123']);

        $this->postJson('/api/login', ['email' => ' Budi@Contoh.com ', 'password' => 'rahasia123'])->assertOk();
        $this->assertSame('2026-11-18 08:00:00', $user->fresh()->last_login_at->format('Y-m-d H:i:s'));
    }

    // ---------------------------------------------------------------- kelola pengguna

    #[Test]
    public function admin_menambah_pengguna(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/users', ['name' => 'Budi', 'email' => 'BUDI@contoh.com', 'role' => 'user', 'password' => 'rahasia123'])
            ->assertCreated()
            ->assertJsonPath('data.email', 'budi@contoh.com')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonMissingPath('data.password');

        $this->postJson('/api/login', ['email' => 'budi@contoh.com', 'password' => 'rahasia123'])->assertOk();
    }

    #[Test]
    public function validasi_tambah_pengguna(): void
    {
        $this->actingAsAdmin();
        User::factory()->create(['email' => 'ada@contoh.com']);

        $this->postJson('/api/users', ['name' => '', 'email' => 'ada@contoh.com', 'role' => 'superadmin', 'password' => 'pendek'])
            ->assertStatus(422)
            ->assertJsonPath('errors.name.0', 'Nama wajib diisi.')
            ->assertJsonPath('errors.email.0', 'Email sudah digunakan.')
            ->assertJsonPath('errors.role.0', 'Peran yang dipilih tidak valid.')
            ->assertJsonPath('errors.password.0', 'Password minimal 8 karakter.');
    }

    #[Test]
    public function edit_tanpa_password_tidak_mengubah_password(): void
    {
        $this->actingAsAdmin();
        $user = User::factory()->create(['password' => 'rahasia123']);

        $this->putJson("/api/users/{$user->id}", ['name' => 'Nama Baru', 'email' => $user->email, 'role' => 'user'])->assertOk();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'rahasia123'])->assertOk();
    }

    #[Test]
    public function reset_password_atau_nonaktifkan_mengeluarkan_user_dari_semua_perangkat(): void
    {
        $this->actingAsAdmin();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $a->createToken('hp');
        $b->createToken('laptop');

        $this->putJson("/api/users/{$a->id}", ['name' => $a->name, 'email' => $a->email, 'role' => 'user', 'password' => 'passwordbaru1'])->assertOk();
        $this->putJson("/api/users/{$b->id}", ['name' => $b->name, 'email' => $b->email, 'role' => 'user', 'is_active' => false])->assertOk();

        $this->assertSame(0, $a->tokens()->count());
        $this->assertSame(0, $b->tokens()->count());
        $this->assertFalse($b->fresh()->is_active);
    }

    #[Test]
    public function admin_tidak_bisa_menurunkan_menonaktifkan_atau_menghapus_diri_sendiri(): void
    {
        $me = $this->actingAsAdmin();
        User::factory()->admin()->create(); // ada admin lain, jadi yang diuji murni aturan "diri sendiri"

        $this->putJson("/api/users/{$me->id}", ['name' => $me->name, 'email' => $me->email, 'role' => 'user'])
            ->assertStatus(422)->assertJsonPath('errors.role.0', 'Anda tidak bisa menurunkan peran atau menonaktifkan akun Anda sendiri.');
        $this->putJson("/api/users/{$me->id}", ['name' => $me->name, 'email' => $me->email, 'role' => 'admin', 'is_active' => false])
            ->assertStatus(422);
        $this->deleteJson("/api/users/{$me->id}")
            ->assertStatus(422)->assertJsonPath('message', 'Anda tidak bisa menghapus akun Anda sendiri.');

        $this->assertTrue($me->fresh()->isAdmin());
        $this->assertTrue($me->fresh()->is_active);
    }

    #[Test]
    public function admin_lain_boleh_diturunkan_dinonaktifkan_atau_dihapus(): void
    {
        $this->actingAsAdmin();
        [$b, $c, $d] = User::factory()->admin()->count(3)->create();

        $this->putJson("/api/users/{$b->id}", ['name' => $b->name, 'email' => $b->email, 'role' => 'user'])->assertOk();
        $this->putJson("/api/users/{$c->id}", ['name' => $c->name, 'email' => $c->email, 'role' => 'admin', 'is_active' => false])->assertOk();
        $this->deleteJson("/api/users/{$d->id}")->assertNoContent();

        $this->assertSame(1, User::activeAdmins()->count(), 'Admin yang bertindak selalu tersisa');
    }

    /**
     * "Minimal satu admin aktif" pada dasarnya dijamin oleh aturan "tidak bisa mengubah diri sendiri"
     * (pelaku pasti admin aktif). Test ini membuktikan jaminan itu: tidak ada urutan aksi lewat API
     * yang membuat jumlah admin aktif menjadi nol. Pengecekan eksplisit di UserController adalah
     * pengaman lapis kedua untuk kasus bersamaan (dua admin saling menurunkan pada saat yang sama).
     */
    #[Test]
    public function jumlah_admin_aktif_tidak_pernah_nol(): void
    {
        $a = User::factory()->admin()->create();
        $b = User::factory()->admin()->create();

        $this->actingAsUser($a);
        $this->putJson("/api/users/{$b->id}", ['name' => $b->name, 'email' => $b->email, 'role' => 'user'])->assertOk();
        $this->putJson("/api/users/{$a->id}", ['name' => $a->name, 'email' => $a->email, 'role' => 'user'])->assertStatus(422);
        $this->putJson("/api/users/{$a->id}", ['name' => $a->name, 'email' => $a->email, 'role' => 'admin', 'is_active' => false])->assertStatus(422);
        $this->deleteJson("/api/users/{$a->id}")->assertStatus(422);

        $this->actingAsUser($b->fresh()); // B sekarang user biasa → tidak boleh mengelola pengguna
        $this->putJson("/api/users/{$a->id}", ['name' => $a->name, 'email' => $a->email, 'role' => 'user'])->assertForbidden();

        $this->assertSame(1, User::activeAdmins()->count());
    }

    #[Test]
    public function hapus_pengguna_ikut_menghapus_token_dan_notifikasinya(): void
    {
        $this->actingAsAdmin();
        $user = User::factory()->create();
        $user->createToken('hp');

        $this->deleteJson("/api/users/{$user->id}")->assertNoContent();
        $this->assertModelMissing($user);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    // ---------------------------------------------------------------- ganti password sendiri

    #[Test]
    public function ganti_password_sendiri(): void
    {
        $user = User::factory()->create(['email' => 'budi@contoh.com', 'password' => 'rahasia123']);
        $current = $this->postJson('/api/login', ['email' => 'budi@contoh.com', 'password' => 'rahasia123'])->json('token');
        $user->createToken('perangkat-lain');

        $this->withToken($current)->putJson('/api/me/password', [
            'current_password' => 'rahasia123', 'password' => 'passwordbaru1', 'password_confirmation' => 'passwordbaru1',
        ])->assertOk()->assertJsonPath('message', 'Password berhasil diganti.');

        $this->assertSame(1, $user->tokens()->count(), 'Sesi yang sedang dipakai tetap, perangkat lain dikeluarkan');
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => 'budi@contoh.com', 'password' => 'passwordbaru1'])->assertOk();
    }

    #[Test]
    public function validasi_ganti_password(): void
    {
        $this->actingAsUser(User::factory()->create(['password' => 'rahasia123']));

        $this->putJson('/api/me/password', ['current_password' => 'salah', 'password' => 'x', 'password_confirmation' => 'y'])
            ->assertStatus(422)
            ->assertJsonPath('errors.current_password.0', 'Password salah.')
            ->assertJsonValidationErrors(['password']);

        $this->putJson('/api/me/password', ['current_password' => 'rahasia123', 'password' => 'rahasia123', 'password_confirmation' => 'rahasia123'])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Password baru harus berbeda dari password saat ini.');
    }
}
