<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Pengaman: test (dengan RefreshDatabase) mengosongkan database. Pastikan yang dipakai
        // SELALU database di memori, bukan database.sqlite / MySQL asli.
        $db = DB::connection()->getDatabaseName();
        if (DB::connection()->getDriverName() !== 'sqlite' || $db !== ':memory:') {
            throw new RuntimeException("Test dihentikan: terhubung ke database '{$db}', bukan :memory:. Periksa phpunit.xml.");
        }
    }

    /** Login sebagai admin (akses penuh) untuk request API. */
    protected function actingAsAdmin(?User $user = null): User
    {
        return $this->actingAsUser($user ?? User::factory()->admin()->create());
    }

    /** Login sebagai pengguna tertentu; tanpa argumen = pengguna biasa (peran "user"). */
    protected function actingAsUser(?User $user = null): User
    {
        $user ??= User::factory()->create();
        Sanctum::actingAs($user);

        return $user;
    }
}
