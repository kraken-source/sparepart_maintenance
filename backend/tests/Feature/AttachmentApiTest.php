<?php

namespace Tests\Feature;

use App\Models\MaintenanceAttachment;
use App\Models\MaintenanceRecord;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AttachmentApiTest extends TestCase
{
    use RefreshDatabase;

    private MaintenanceRecord $record;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(MaintenanceAttachment::DISK); // jangan pernah menulis ke storage asli
        $this->actingAsAdmin();
        $this->record = MaintenanceRecord::factory()->create();
    }

    private function upload(array $files)
    {
        return $this->post("/api/maintenance-records/{$this->record->id}/attachments", ['files' => $files], ['Accept' => 'application/json']);
    }

    #[Test]
    public function upload_gambar_dan_pdf(): void
    {
        $res = $this->upload([
            UploadedFile::fake()->image('nota.jpg', 800, 600),
            UploadedFile::fake()->create('invoice.pdf', 120, 'application/pdf'),
        ])->assertCreated()->assertJsonCount(2, 'data');

        $res->assertJsonMissingPath('data.0.path'); // path internal tidak bocor
        foreach (MaintenanceAttachment::all() as $a) {
            Storage::disk(MaintenanceAttachment::DISK)->assertExists($a->path);
            $this->assertStringNotContainsString('nota', $a->path, 'Nama file asli tidak dipakai di path');
        }
    }

    #[Test]
    public function tipe_file_selain_gambar_dan_pdf_ditolak(): void
    {
        $this->upload([UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload')])
            ->assertStatus(422)
            ->assertJsonPath('errors', fn ($errors) => str_contains(json_encode($errors), 'File harus berupa gambar (JPG, PNG, WEBP) atau PDF.'));
    }

    #[Test]
    public function maksimal_10_lampiran_per_catatan(): void
    {
        $files = array_map(fn ($i) => UploadedFile::fake()->image("n{$i}.png", 10, 10), range(1, 11));

        $this->upload($files)->assertStatus(422);
        $this->assertDatabaseCount('maintenance_attachments', 0);
    }

    #[Test]
    public function unduh_lampiran_lalu_hapus_beserta_filenya(): void
    {
        $this->upload([UploadedFile::fake()->image('nota.png', 20, 20)])->assertCreated();
        $a = MaintenanceAttachment::first();

        $this->get("/api/attachments/{$a->id}")->assertOk()->assertHeader('Content-Type', 'image/png');

        $this->deleteJson("/api/attachments/{$a->id}")->assertNoContent();
        Storage::disk(MaintenanceAttachment::DISK)->assertMissing($a->path);
    }

    #[Test]
    public function hapus_catatan_ikut_menghapus_file_lampiran(): void
    {
        $this->upload([UploadedFile::fake()->image('a.png', 20, 20), UploadedFile::fake()->image('b.png', 20, 20)])->assertCreated();
        $paths = MaintenanceAttachment::pluck('path');

        $this->deleteJson("/api/maintenance-records/{$this->record->id}")->assertNoContent();

        $this->assertDatabaseCount('maintenance_attachments', 0);
        foreach ($paths as $p) {
            Storage::disk(MaintenanceAttachment::DISK)->assertMissing($p);
        }
    }
}
