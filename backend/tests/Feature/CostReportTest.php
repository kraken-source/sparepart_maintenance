<?php

namespace Tests\Feature;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CostReportTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $a;

    private Vehicle $b;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00:00');
        $this->actingAsAdmin(); // admin melihat semua kendaraan; laporan per pemilik diuji di VehicleOwnershipTest

        $this->a = Vehicle::factory()->create(['plate_number' => 'B 1 AAA']);
        $this->b = Vehicle::factory()->create(['plate_number' => 'B 2 BBB']);
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
        $this->assertSame(['Body', 'Mesin', 'Rem'], $d['categories'], 'Urutan kategori tetap (alfabetis) untuk warna grafik');
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
        $this->assertSame(['Ringkasan', 'Per Bulan', 'Per Part', 'Detail'], $book->getSheetNames());
        $this->assertSame(3_000_000, (int) $book->getSheetByName('Ringkasan')->getCell('B7')->getValue());
    }
}
