<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CostReportTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $a;

    private Vehicle $b;

    private User $budi;

    private User $sari;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00:00');
        $this->actingAsAdmin(); // admin melihat semua kendaraan; laporan per pemilik diuji di VehicleOwnershipTest

        $this->budi = User::factory()->create(['name' => 'Budi Santoso', 'email' => 'budi@example.com']);
        $this->sari = User::factory()->create(['name' => 'Sari', 'email' => 'sari@example.com']);
        $this->a = Vehicle::factory()->for($this->budi, 'owner')->create(['plate_number' => 'B 1 AAA']);
        $this->b = Vehicle::factory()->for($this->sari, 'owner')->create(['plate_number' => 'B 2 BBB']);
        $mesin = Part::factory()->create(['name' => 'Oli', 'category' => 'Mesin']);
        $rem = Part::factory()->create(['name' => 'Kampas', 'category' => 'Rem']);
        Part::factory()->create(['category' => 'Body']); // kategori tanpa biaya

        $rec = fn ($v, $p, $date, $cost) => MaintenanceRecord::factory()->for($v)->for($p)->create(['service_date' => $date, 'cost' => $cost]);
        $rec($this->a, $mesin, '2026-01-15', 1_000_000);
        $rec($this->a, $rem, '2026-03-31', 2_000_000); // tepat di tanggal akhir rentang uji
        $rec($this->b, $mesin, '2026-02-10', 500_000);
        $rec($this->a, $mesin, '2025-12-31', 9_000_000); // di luar rentang
    }

    private function report(string $query)
    {
        return $this->getJson("/api/reports/costs?{$query}")->assertOk()->json('data');
    }

    #[Test]
    public function ringkasan_dan_pengelompokan(): void
    {
        $d = $this->report('from=2026-01-01&to=2026-03-31');

        $this->assertSame(3_500_000, $d['summary']['total']);
        $this->assertSame(3, $d['summary']['count']);
        $this->assertSame(3, $d['summary']['months']);
        $this->assertSame(1_166_667, $d['summary']['avg_per_month']);
        $this->assertSame('Rem', $d['summary']['top_category']['category']);

        $this->assertSame(['Rem' => 2_000_000, 'Mesin' => 1_500_000], collect($d['by_category'])->pluck('total', 'category')->all());
        $this->assertSame(['B 1 AAA' => 3_000_000, 'B 2 BBB' => 500_000], collect($d['by_vehicle'])->pluck('total', 'plate_number')->all());
        $this->assertSame(['Body', 'Mesin', 'Rem', 'Bahan Bakar'], $d['categories'], 'Urutan kategori tetap (alfabetis), Bahan Bakar selalu terakhir');
    }

    #[Test]
    public function catatan_di_hari_terakhir_rentang_ikut_terhitung(): void
    {
        // Regresi bug format tanggal campuran.
        $d = $this->report('from=2026-03-01&to=2026-03-31');

        $this->assertSame(2_000_000, $d['summary']['total']);
        $this->assertSame(1, $d['summary']['count']);
    }

    #[Test]
    public function semua_bulan_dalam_rentang_ada_termasuk_yang_nol(): void
    {
        $d = $this->report('from=2026-01-01&to=2026-04-30');

        $this->assertSame(['Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'], array_column($d['monthly'], 'label'));
        $this->assertSame([1_000_000, 500_000, 2_000_000, 0], array_column($d['monthly'], 'total'));
        $this->assertSame(2_000_000, $d['monthly'][2]['by_category']['Rem']);
    }

    #[Test]
    public function filter_satu_kendaraan(): void
    {
        $d = $this->report("from=2026-01-01&to=2026-12-31&vehicle_id={$this->b->id}");

        $this->assertSame(500_000, $d['summary']['total']);
        $this->assertSame('B 2 BBB', $d['filter']['vehicle']['plate_number']);
    }

    #[Test]
    public function validasi_rentang_tanggal(): void
    {
        $this->getJson('/api/reports/costs?from=2026-05-01&to=2026-01-01')
            ->assertStatus(422)
            ->assertJsonPath('errors.to.0', 'Tanggal akhir harus berupa tanggal yang sama dengan atau setelah tanggal awal.');

        $this->getJson('/api/reports/costs?from=2010-01-01&to=2026-01-01')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Rentang laporan maksimal 5 tahun.');
    }

    #[Test]
    public function export_excel(): void
    {
        $res = $this->get("/api/reports/costs/export?from=2026-01-01&to=2026-03-31&vehicle_id={$this->a->id}", ['Accept' => 'application/json'])
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->assertStringContainsString('laporan-biaya_2026-01-01_2026-03-31_B1AAA.xlsx', $res->headers->get('Content-Disposition'));

        $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($res->baseResponse->getFile()->getPathname());
        $this->assertSame(['Ringkasan', 'Per Bulan', 'Per Part', 'Detail', 'BBM'], $book->getSheetNames());
        $this->assertSame(3_000_000, (int) $book->getSheetByName('Ringkasan')->getCell('B8')->getValue());
    }

    #[Test]
    public function admin_melihat_biaya_per_pemilik(): void
    {
        // Kendaraan kedua milik Budi → Budi punya 2 kendaraan, termahal tetap B 1 AAA.
        $c = Vehicle::factory()->for($this->budi, 'owner')->create(['plate_number' => 'B 3 CCC']);
        MaintenanceRecord::factory()->for($c)->for(Part::first())->create(['service_date' => '2026-02-01', 'cost' => 250_000]);

        $d = $this->report('from=2026-01-01&to=2026-03-31');

        $this->assertTrue($d['with_owners']);
        $this->assertSame(['Budi Santoso' => 3_250_000, 'Sari' => 500_000], collect($d['by_owner'])->pluck('total', 'name')->all());
        $budi = collect($d['by_owner'])->firstWhere('owner_id', $this->budi->id);
        $this->assertSame(2, $budi['vehicles']);
        $this->assertSame(3, $budi['count']);
        $this->assertSame('B 1 AAA', $budi['top_vehicle']);
        $this->assertSame('budi@example.com', $budi['email']);

        $this->assertSame('Sari', collect($d['by_vehicle'])->firstWhere('plate_number', 'B 2 BBB')['owner']);
        $this->assertSame('Sari', collect($d['records'])->firstWhere('plate_number', 'B 2 BBB')['owner']);
    }

    #[Test]
    public function filter_pemilik(): void
    {
        $d = $this->report("from=2026-01-01&to=2026-03-31&owner_id={$this->budi->id}");

        $this->assertSame(3_000_000, $d['summary']['total']);
        $this->assertSame(['B 1 AAA'], collect($d['by_vehicle'])->pluck('plate_number')->all());
        $this->assertSame('Budi Santoso', $d['filter']['owner']['name']);

        // Pemilik + kendaraannya sendiri → boleh.
        $d = $this->report("from=2026-01-01&to=2026-03-31&owner_id={$this->budi->id}&vehicle_id={$this->a->id}");
        $this->assertSame(3_000_000, $d['summary']['total']);
    }

    #[Test]
    public function filter_pemilik_dengan_kendaraan_orang_lain_ditolak(): void
    {
        $this->getJson("/api/reports/costs?owner_id={$this->budi->id}&vehicle_id={$this->b->id}")
            ->assertStatus(422)
            ->assertJsonPath('errors.vehicle_id.0', 'Kendaraan yang dipilih bukan milik pemilik tersebut.');

        $this->getJson('/api/reports/costs?owner_id=99999')
            ->assertStatus(422)
            ->assertJsonPath('errors.owner_id.0', 'Pemilik yang dipilih tidak ditemukan.');
    }

    #[Test]
    public function user_biasa_tidak_bisa_memakai_filter_pemilik_dan_tidak_melihat_data_pemilik(): void
    {
        $this->actingAsUser($this->budi);

        $this->getJson("/api/reports/costs?owner_id={$this->sari->id}")
            ->assertStatus(422)
            ->assertJsonPath('errors.owner_id.0', 'Pemilik tidak diizinkan.');

        $d = $this->report('from=2026-01-01&to=2026-03-31');
        $this->assertFalse($d['with_owners']);
        $this->assertNull($d['by_owner']);
        $this->assertArrayNotHasKey('owner', $d['by_vehicle'][0]);
        $this->assertNull($d['records'][0]['owner']);
        $this->assertSame(3_000_000, $d['summary']['total']);
    }

    #[Test]
    public function export_excel_per_pemilik(): void
    {
        $res = $this->get("/api/reports/costs/export?from=2026-01-01&to=2026-03-31&owner_id={$this->budi->id}", ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertStringContainsString('laporan-biaya_2026-01-01_2026-03-31_budi-santoso.xlsx', $res->headers->get('Content-Disposition'));

        $book = \PhpOffice\PhpSpreadsheet\IOFactory::load($res->baseResponse->getFile()->getPathname());
        $ringkasan = $book->getSheetByName('Ringkasan');
        $this->assertSame('Budi Santoso (budi@example.com)', $ringkasan->getCell('B4')->getValue());
        $this->assertSame(3_000_000, (int) $ringkasan->getCell('B8')->getValue());
        $this->assertSame('Pemilik', $book->getSheetByName('Detail')->getCell('C1')->getValue());
        $this->assertSame('Budi Santoso', $book->getSheetByName('Detail')->getCell('C2')->getValue());

        // Tanpa filter pemilik, ringkasan memuat tabel "Biaya per pemilik".
        $res = $this->get('/api/reports/costs/export?from=2026-01-01&to=2026-03-31', ['Accept' => 'application/json'])->assertOk();
        $ringkasan = \PhpOffice\PhpSpreadsheet\IOFactory::load($res->baseResponse->getFile()->getPathname())->getSheetByName('Ringkasan');
        $this->assertSame('Biaya per pemilik', $ringkasan->getCell('A16')->getValue());
        $this->assertSame('Budi Santoso', $ringkasan->getCell('A18')->getValue());
    }
}
