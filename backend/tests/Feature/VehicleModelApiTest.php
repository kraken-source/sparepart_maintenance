<?php

namespace Tests\Feature;

use App\Models\Vehicle;
use App\Models\VehicleModel;
use App\Support\GlbInspector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Master model 3D: daftar, upload .glb, thumbnail, aturan hapus, dan pilihan model di kendaraan. */
class VehicleModelApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** File .glb minimal yang valid dengan nama node tertentu. */
    private function glb(array $nodeNames = ['engine_oil', 'Body Shell', 'battery'], string $name = 'mobil.glb'): UploadedFile
    {
        $json = json_encode(['asset' => ['version' => '2.0'], 'nodes' => array_map(fn ($n) => ['name' => $n], $nodeNames)]);
        $json .= str_repeat(' ', (4 - strlen($json) % 4) % 4); // chunk JSON harus kelipatan 4 byte
        $body = pack('VV', strlen($json), 0x4E4F534A).$json;
        $bin = pack('VVV', 0x46546C67, 2, 12 + strlen($body)).$body;

        return UploadedFile::fake()->createWithContent($name, $bin);
    }

    private function png(): UploadedFile
    {
        return UploadedFile::fake()->image('thumb.png', 480, 300);
    }

    #[Test]
    public function model_bawaan_tersedia_dan_kendaraan_baru_memakai_default(): void
    {
        $this->actingAsUser();

        $list = collect($this->getJson('/api/vehicle-models')->assertOk()->json('data'));
        $this->assertSame(['palisade', 'innova', 'beat'], $list->pluck('builtin_key')->filter()->values()->sortBy(fn ($k) => array_search($k, ['palisade', 'innova', 'beat']))->values()->all());

        $this->postJson('/api/vehicles', ['type' => 'motorcycle', 'plate_number' => 'B 1 MTR', 'brand' => 'Honda', 'model' => 'Beat', 'odometer' => 100])
            ->assertCreated()->assertJsonPath('data.vehicle_model.builtin_key', 'beat');
    }

    #[Test]
    public function user_biasa_tidak_bisa_mengelola_master(): void
    {
        $this->actingAsUser();
        $this->postJson('/api/vehicle-models', ['name' => 'X', 'vehicle_type' => 'car', 'file' => $this->glb()])->assertForbidden();
        $this->postJson('/api/vehicle-models/1/thumbnail', ['thumbnail' => $this->png()])->assertForbidden();
    }

    #[Test]
    public function admin_upload_glb_nama_objek_dibaca_dan_file_bisa_diunduh_tanpa_login(): void
    {
        $this->actingAsAdmin();

        $res = $this->post('/api/vehicle-models', [
            'name' => 'Avanza 2022', 'vehicle_type' => 'car', 'file' => $this->glb(), 'thumbnail' => $this->png(),
        ], ['Accept' => 'application/json'])->assertCreated();

        $model = VehicleModel::findOrFail($res->json('data.id'));
        $this->assertSame(['Body_Shell', 'battery', 'engine_oil'], $model->mesh_names, 'spasi → "_" seperti three.js');
        $this->assertSame('glb', $model->source);
        Storage::disk('local')->assertExists([$model->file_path, $model->thumbnail_path]);
        $this->assertStringStartsWith("/api/vehicle-models/{$model->id}/file?v=", $res->json('data.file_url'));
        $this->assertArrayNotHasKey('file_path', $res->json('data'), 'path internal tidak dikirim ke frontend');

        // Viewer 3D & <img> memuat tanpa token.
        $this->app['auth']->forgetGuards();
        $this->get($res->json('data.file_url'))->assertOk()->assertHeader('Content-Type', 'model/gltf-binary');
        $this->get($res->json('data.thumbnail_url'))->assertOk();
    }

    #[Test]
    public function file_harus_glb_asli_dan_maksimal_20_mb(): void
    {
        $this->actingAsAdmin();

        $this->post('/api/vehicle-models', ['name' => 'Palsu', 'vehicle_type' => 'car', 'file' => UploadedFile::fake()->createWithContent('palsu.glb', 'bukan glb sama sekali, cuma teks')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'Bukan file glTF biner (.glb) yang valid.');

        $this->post('/api/vehicle-models', ['name' => 'Gltf', 'vehicle_type' => 'car', 'file' => UploadedFile::fake()->create('mobil.gltf', 10)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'File model harus berformat .glb (glTF biner).');

        $this->post('/api/vehicle-models', ['name' => 'Besar', 'vehicle_type' => 'car', 'file' => UploadedFile::fake()->create('besar.glb', 21000)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('errors.file.0', 'Ukuran file model maksimal 20 MB.');

        $this->post('/api/vehicle-models', ['name' => 'Tanpa file', 'vehicle_type' => 'car'], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('file');
    }

    #[Test]
    public function ganti_file_menghapus_file_lama(): void
    {
        $this->actingAsAdmin();
        $id = $this->post('/api/vehicle-models', ['name' => 'Avanza', 'vehicle_type' => 'car', 'file' => $this->glb()], ['Accept' => 'application/json'])->json('data.id');
        $old = VehicleModel::find($id)->file_path;

        $this->post("/api/vehicle-models/{$id}", ['_method' => 'PUT', 'name' => 'Avanza Baru', 'vehicle_type' => 'car', 'file' => $this->glb(['wiper'])], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.name', 'Avanza Baru')->assertJsonPath('data.mesh_names', ['wiper']);

        Storage::disk('local')->assertMissing($old);
    }

    #[Test]
    public function thumbnail_dan_nama_objek_model_bawaan(): void
    {
        $this->actingAsAdmin();
        $palisade = VehicleModel::where('builtin_key', 'palisade')->first();

        $this->post("/api/vehicle-models/{$palisade->id}/thumbnail", ['thumbnail' => $this->png(), 'mesh_names' => ['engine_oil', 'battery', 'engine_oil']], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.mesh_names', ['battery', 'engine_oil']);
        $this->assertNotNull($palisade->fresh()->thumbnail_path);

        // Bawaan: tidak bisa ganti jenis / diberi file / dihapus.
        $this->putJson("/api/vehicle-models/{$palisade->id}", ['name' => 'Palisade', 'vehicle_type' => 'motorcycle'])
            ->assertStatus(422)->assertJsonPath('errors.vehicle_type.0', 'Jenis kendaraan model bawaan tidak bisa diubah.');
        $this->deleteJson("/api/vehicle-models/{$palisade->id}")
            ->assertStatus(422)->assertJsonPath('message', 'Model bawaan tidak bisa dihapus. Nonaktifkan saja bila tidak dipakai.');
        $this->putJson("/api/vehicle-models/{$palisade->id}", ['name' => 'Palisade Gen 2', 'is_active' => false])
            ->assertOk()->assertJsonPath('data.name', 'Palisade Gen 2');
    }

    #[Test]
    public function model_yang_dipakai_tidak_bisa_dihapus_yang_tidak_dipakai_terhapus_beserta_filenya(): void
    {
        $this->actingAsAdmin();
        $id = $this->post('/api/vehicle-models', ['name' => 'Avanza', 'vehicle_type' => 'car', 'file' => $this->glb()], ['Accept' => 'application/json'])->json('data.id');
        $car = Vehicle::factory()->create(['vehicle_model_id' => $id]);

        $this->deleteJson("/api/vehicle-models/{$id}")->assertStatus(422)
            ->assertJsonPath('message', 'Model "Avanza" tidak bisa dihapus karena dipakai 1 kendaraan. Ganti model kendaraannya dulu, atau nonaktifkan model ini.');
        $this->putJson("/api/vehicle-models/{$id}", ['name' => 'Avanza', 'vehicle_type' => 'motorcycle'])
            ->assertStatus(422)->assertJsonPath('errors.vehicle_type.0', 'Jenis kendaraan tidak bisa diubah karena model ini dipakai 1 kendaraan.');

        $path = VehicleModel::find($id)->file_path;
        $car->update(['vehicle_model_id' => null]);
        $this->deleteJson("/api/vehicle-models/{$id}")->assertNoContent();
        Storage::disk('local')->assertMissing($path);
    }

    #[Test]
    public function kendaraan_hanya_bisa_memilih_model_yang_sesuai_dan_aktif(): void
    {
        $user = $this->actingAsUser();
        $beat = VehicleModel::where('builtin_key', 'beat')->first();
        $off = VehicleModel::factory()->create(['name' => 'Lama', 'is_active' => false]);
        $car = Vehicle::factory()->for($user, 'owner')->create(['vehicle_model_id' => $off->id]);
        $payload = fn ($modelId) => ['plate_number' => $car->plate_number, 'brand' => 'Toyota', 'model' => 'Avanza', 'odometer' => 50000, 'vehicle_model_id' => $modelId];

        $this->putJson("/api/vehicles/{$car->id}", $payload($beat->id))
            ->assertStatus(422)->assertJsonPath('errors.vehicle_model_id.0', 'Model Honda BeAT eSP 2021 untuk sepeda motor, tidak sesuai dengan jenis kendaraan.');
        // Model nonaktif yang sudah dipakai kendaraan ini tetap boleh; untuk kendaraan lain ditolak.
        $this->putJson("/api/vehicles/{$car->id}", $payload($off->id))->assertOk();
        $this->postJson('/api/vehicles', ['plate_number' => 'B 9 NEW', 'brand' => 'X', 'model' => 'Y', 'odometer' => 1, 'vehicle_model_id' => $off->id])
            ->assertStatus(422)->assertJsonPath('errors.vehicle_model_id.0', 'Model Lama sudah tidak aktif.');
    }

    #[Test]
    public function migration_memindahkan_model_3d_url_lama(): void
    {
        // Simulasikan data lama: kembalikan migration ini, isi model_3d_url, lalu jalankan lagi.
        $migration = require database_path('migrations/2026_11_20_000001_create_vehicle_models_table.php');
        $migration->down();
        $this->assertTrue(Schema::hasColumn('vehicles', 'model_3d_url'));

        $owner = \App\Models\User::factory()->create();
        $insert = fn ($plate, $type, $url) => DB::table('vehicles')->insertGetId([
            'user_id' => $owner->id, 'type' => $type, 'plate_number' => $plate, 'brand' => 'X', 'model' => 'Y',
            'odometer' => 1, 'model_3d_url' => $url, 'fuel_group' => 'gasoline', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $ids = [
            'kosong' => $insert('B 1', 'car', null),
            'innova' => $insert('B 2', 'car', 'builtin:innova'),
            'beat_salah_jenis' => $insert('B 3', 'car', 'builtin:beat'),
            'motor' => $insert('B 4', 'motorcycle', null),
            'glb_hilang' => $insert('B 5', 'car', '/models/tidak-ada.glb'),
        ];

        $migration->up();

        $this->assertFalse(Schema::hasColumn('vehicles', 'model_3d_url'));
        $key = fn ($id) => VehicleModel::find(Vehicle::find($id)->vehicle_model_id)?->builtin_key;
        $this->assertSame('palisade', $key($ids['kosong']));
        $this->assertSame('innova', $key($ids['innova']));
        $this->assertSame('palisade', $key($ids['beat_salah_jenis']), 'model motor di mobil → default mobil');
        $this->assertSame('beat', $key($ids['motor']));
        $this->assertSame('palisade', $key($ids['glb_hilang']), 'file tidak ditemukan → default, kendaraan tetap tampil');
    }

    #[Test]
    public function glb_inspector_menolak_file_rusak(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'glb');
        file_put_contents($path, pack('VVV', 0x46546C67, 1, 12));
        try {
            GlbInspector::inspect($path);
            $this->fail('Seharusnya ditolak');
        } catch (\InvalidArgumentException $e) {
            $this->assertSame('File terlalu kecil untuk file .glb.', $e->getMessage());
        } finally {
            unlink($path);
        }
        // Sama dengan three.js: spasi → "_", titik dihapus.
        $this->assertSame('Lampu_DepanKiri', GlbInspector::sanitize('Lampu Depan.Kiri'));
    }
}
