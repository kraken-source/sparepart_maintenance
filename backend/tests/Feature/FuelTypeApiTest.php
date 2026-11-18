<?php

namespace Tests\Feature;

use App\Models\FuelLog;
use App\Models\FuelType;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FuelTypeApiTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function daftar_bawaan_tersedia_untuk_semua_user(): void
    {
        $this->actingAsUser();

        $names = collect($this->getJson('/api/fuel-types')->assertOk()->json('data'))->pluck('group', 'name');
        $this->assertSame('gasoline', $names['Pertalite']);
        $this->assertSame('diesel', $names['Dexlite']);
    }

    #[Test]
    public function user_biasa_tidak_bisa_mengubah_master(): void
    {
        $this->actingAsUser();
        $this->postJson('/api/fuel-types', ['name' => 'Revvo 92', 'group' => 'gasoline'])->assertForbidden();
    }

    #[Test]
    public function admin_mengelola_jenis_bbm(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/fuel-types', ['name' => 'Revvo 92', 'group' => 'gasoline', 'rating' => 92])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/fuel-types', ['name' => 'Revvo 92', 'group' => 'gasoline'])
            ->assertStatus(422)->assertJsonValidationErrors('name');

        $this->putJson("/api/fuel-types/{$id}", ['name' => 'Revvo 92', 'group' => 'gasoline', 'is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->deleteJson("/api/fuel-types/{$id}")->assertNoContent();
    }

    #[Test]
    public function jenis_yang_dipakai_tidak_bisa_dihapus_atau_diganti_kelompok(): void
    {
        $this->actingAsAdmin();
        $type = FuelType::factory()->create(['name' => 'Revvo 92']);
        FuelLog::factory()->for(Vehicle::factory())->create(['fuel_type_id' => $type->id]);

        $this->deleteJson("/api/fuel-types/{$type->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Jenis BBM "Revvo 92" tidak bisa dihapus karena dipakai di 1 catatan pengisian. Nonaktifkan saja agar tidak muncul lagi di pilihan.');

        $this->putJson("/api/fuel-types/{$type->id}", ['name' => 'Revvo 92', 'group' => 'diesel'])
            ->assertStatus(422)
            ->assertJsonPath('errors.group.0', 'Kelompok tidak bisa diubah karena jenis BBM ini sudah dipakai di catatan pengisian.');
    }
}
