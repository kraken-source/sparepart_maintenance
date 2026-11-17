<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Semua pesan dari API berbahasa Indonesia.
 */
class LocalizationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function terjemahan_validasi_lengkap_untuk_semua_aturan_laravel(): void
    {
        $flatten = function (array $a, string $prefix = '') use (&$flatten): array {
            $keys = [];
            foreach ($a as $k => $v) {
                if (in_array($k, ['custom', 'attributes'], true)) {
                    continue;
                }
                is_array($v) ? array_push($keys, ...$flatten($v, "{$prefix}{$k}.")) : $keys[] = "{$prefix}{$k}";
            }

            return $keys;
        };

        $en = $flatten(require lang_path('en/validation.php'));
        $id = $flatten(require lang_path('id/validation.php'));

        $this->assertSame([], array_values(array_diff($en, $id)), 'Kunci validasi yang belum diterjemahkan');
    }

    #[Test]
    public function pesan_validasi_memakai_nama_field_indonesia(): void
    {
        $this->actingAsUser();

        $this->postJson('/api/maintenance-records', [])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Kendaraan wajib diisi. (dan 4 kesalahan lainnya)')
            ->assertJsonPath('errors.service_date.0', 'Tanggal servis wajib diisi.');
    }

    #[Test]
    public function pesan_error_http_berbahasa_indonesia(): void
    {
        $this->getJson('/api/vehicles')->assertUnauthorized()->assertJsonPath('message', 'Sesi login berakhir. Silakan masuk kembali.');

        $this->actingAsUser();
        $this->getJson('/api/maintenance-records/999999')->assertNotFound()->assertJsonPath('message', 'Data tidak ditemukan.');
        $this->getJson('/api/tidak-ada')->assertNotFound()->assertJsonPath('message', 'Data tidak ditemukan.');
        $this->patchJson('/api/reports/costs')->assertStatus(405)->assertJsonPath('message', 'Metode permintaan tidak diizinkan.');
    }
}
