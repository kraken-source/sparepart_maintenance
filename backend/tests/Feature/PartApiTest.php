<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PartApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsAdmin();
    }

    #[Test]
    public function tambah_part_dan_nama_mesh_jadi_huruf_kecil(): void
    {
        $this->postJson('/api/parts', ['vehicle_type' => 'car', 'name' => 'Busi', 'category' => 'Mesin', 'mesh_name' => 'SPARK_PLUG', 'interval_km' => 40000])
            ->assertCreated()
            ->assertJsonPath('data.mesh_name', 'spark_plug');
    }

    #[Test]
    public function nama_mesh_harus_format_valid_dan_unik(): void
    {
        Part::factory()->create(['mesh_name' => 'battery']);

        $this->postJson('/api/parts', ['vehicle_type' => 'car', 'name' => 'Busi', 'category' => 'Mesin', 'mesh_name' => 'Spark Plug!'])
            ->assertStatus(422)
            ->assertJsonPath('errors.mesh_name.0', 'Nama mesh hanya boleh huruf kecil, angka dan underscore (mis. tire_front_left).');

        $this->postJson('/api/parts', ['vehicle_type' => 'car', 'name' => 'Aki 2', 'category' => 'Kelistrikan', 'mesh_name' => 'battery'])
            ->assertStatus(422)
            ->assertJsonPath('errors.mesh_name.0', 'Nama mesh 3D sudah digunakan.');
    }

    #[Test]
    public function part_yang_dipakai_catatan_tidak_bisa_dihapus(): void
    {
        $used = MaintenanceRecord::factory()->create()->part;
        $unused = Part::factory()->create();

        $this->deleteJson("/api/parts/{$used->id}")->assertStatus(422);
        $this->deleteJson("/api/parts/{$unused->id}")->assertNoContent();
        $this->assertModelExists($used);
        $this->assertModelMissing($unused);
    }
}
