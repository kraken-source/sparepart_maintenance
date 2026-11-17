<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::factory()->create(['email' => 'admin@example.com', 'password' => 'rahasia123']);
    }

    #[Test]
    public function login_berhasil_mengembalikan_token_yang_bisa_dipakai(): void
    {
        $this->user();

        $token = $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'rahasia123'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']])
            ->assertJsonMissingPath('user.password')
            ->json('token');

        $this->withToken($token)->getJson('/api/me')->assertOk()->assertJsonPath('data.email', 'admin@example.com');
    }

    #[Test]
    public function password_salah_ditolak_dengan_pesan_indonesia(): void
    {
        $this->user();

        $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'salah'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Email atau password salah.');
    }

    #[Test]
    public function login_dibatasi_5_kali_per_menit(): void
    {
        $this->user();
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'salah'])->assertStatus(422);
        }

        $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'rahasia123'])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Terlalu banyak percobaan login. Coba lagi dalam 1 menit.');
    }

    #[Test]
    public function logout_mencabut_token(): void
    {
        $this->user();
        $token = $this->postJson('/api/login', ['email' => 'admin@example.com', 'password' => 'rahasia123'])->json('token');

        $this->withToken($token)->postJson('/api/logout')->assertNoContent();
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->app['auth']->forgetGuards(); // hindari cache user antar request di dalam satu test
        $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
    }

    #[Test]
    public function semua_endpoint_data_wajib_login(): void
    {
        foreach (['/api/vehicles', '/api/parts', '/api/maintenance-records', '/api/notifications', '/api/reports/costs'] as $url) {
            $this->getJson($url)
                ->assertUnauthorized()
                ->assertJsonPath('message', 'Sesi login berakhir. Silakan masuk kembali.');
        }
    }
}
