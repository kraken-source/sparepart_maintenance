<?php

namespace Tests\Feature;

use App\Models\FuelLog;
use App\Models\FuelType;
use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** Biaya bahan bakar di Laporan Biaya (digabung dengan maintenance). */
class CostReportFuelTest extends TestCase
{
    use RefreshDatabase;

    private User $budi;

    private Vehicle $car;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-17 10:00:00');
        $this->actingAsAdmin();

        $this->budi = User::factory()->create(['name' => 'Budi']);
        $this->car = Vehicle::factory()->for($this->budi, 'owner')->create(['plate_number' => 'B 1 AAA']);
        $other = Vehicle::factory()->create(['plate_number' => 'B 2 BBB']);
        $pertalite = FuelType::where('name', 'Pertalite')->firstOrFail();

        MaintenanceRecord::factory()->for($this->car)->for(Part::factory()->create(['category' => 'Mesin']))
            ->create(['service_date' => '2026-02-10', 'cost' => 1_000_000]);

        $fill = fn ($v, $date, $odo, $liters) => FuelLog::factory()->for($v)->create([
            'fuel_type_id' => $pertalite->id, 'filled_on' => $date, 'odometer' => $odo,
            'liters' => $liters, 'price_per_liter' => 10_000, 'total_cost' => $liters * 10_000,
        ]);
        $fill($this->car, '2026-01-05', 10_000, 40);   // titik awal
        $fill($this->car, '2026-02-05', 10_500, 50);   // 500 km / 50 L = 10 km/L
        $fill($other, '2026-02-20', 5_000, 20);
        $fill($this->car, '2025-12-01', 9_000, 30);    // di luar periode
    }

    private function report(string $query = '')
    {
        return $this->getJson("/api/reports/costs?from=2026-01-01&to=2026-03-31{$query}")->assertOk()->json('data');
    }

    #[Test]
    public function biaya_bbm_digabung_ke_total_bulan_kategori_dan_kendaraan(): void
    {
        $d = $this->report();

        $this->assertSame(2_100_000, $d['summary']['total'], '1 jt maintenance + 1,1 jt BBM');
        $this->assertSame(1_000_000, $d['summary']['maintenance_total']);
        $this->assertSame(1_100_000, $d['summary']['fuel_total']);
        $this->assertSame(1, $d['summary']['count']);
        $this->assertSame(3, $d['summary']['fuel_fills']);
        $this->assertSame('Bahan Bakar', $d['summary']['top_category']['category']);

        $this->assertSame([400_000, 1_700_000, 0], array_column($d['monthly'], 'total'));
        $this->assertSame(700_000, $d['monthly'][1]['by_category']['Bahan Bakar']);
        $this->assertSame(2, $d['monthly'][1]['fuel_fills']);
        $this->assertSame(1, $d['monthly'][1]['count']);

        $car = collect($d['by_vehicle'])->firstWhere('plate_number', 'B 1 AAA');
        $this->assertSame(1_900_000, $car['total']);
        $this->assertSame(1_000_000, $car['maintenance']);
        $this->assertSame(900_000, $car['fuel']);
        $this->assertSame(1, $car['count']);
        $this->assertSame(2, $car['fuel_fills']);
        $this->assertEquals(10, $car['km_per_liter']);

        $budi = collect($d['by_owner'])->firstWhere('name', 'Budi');
        $this->assertSame(900_000, $budi['fuel']);
    }

    #[Test]
    public function bagian_bbm_per_jenis_dan_rincian(): void
    {
        $f = $this->report()['fuel'];

        $this->assertEquals(110, $f['liters']);
        $this->assertSame(10_000, $f['avg_price_per_liter']);
        $this->assertSame('Pertalite', $f['by_type'][0]['name']);
        $this->assertCount(3, $f['records']);
        $this->assertSame('2026-02-20', $f['records'][0]['filled_on'], 'terbaru di atas');
    }

    #[Test]
    public function bbm_bisa_tidak_disertakan(): void
    {
        $d = $this->report('&include_fuel=0');

        $this->assertSame(1_000_000, $d['summary']['total']);
        $this->assertNotContains('Bahan Bakar', $d['categories']);
        $this->assertNull($d['fuel']);
    }

    #[Test]
    public function filter_pemilik_dan_kendaraan_berlaku_untuk_bbm(): void
    {
        $this->assertSame(900_000, $this->report("&owner_id={$this->budi->id}")['summary']['fuel_total']);
        $this->assertSame(900_000, $this->report("&vehicle_id={$this->car->id}")['summary']['fuel_total']);

        // User biasa hanya melihat BBM kendaraannya sendiri.
        $this->actingAsUser($this->budi);
        $d = $this->report();
        $this->assertSame(900_000, $d['summary']['fuel_total']);
        $this->assertSame(['B 1 AAA'], array_values(array_unique(array_column($d['fuel']['records'], 'plate_number'))));
        $this->assertNull($d['fuel']['records'][0]['owner']);
    }

    #[Test]
    public function export_excel_memuat_bbm(): void
    {
        $res = $this->get('/api/reports/costs/export?from=2026-01-01&to=2026-03-31', ['Accept' => 'application/json'])->assertOk();
        $book = IOFactory::load($res->baseResponse->getFile()->getPathname());

        $ringkasan = $book->getSheetByName('Ringkasan');
        $this->assertSame(2_100_000, (int) $ringkasan->getCell('B8')->getValue());
        $this->assertSame(1_000_000, (int) $ringkasan->getCell('B9')->getValue());
        $this->assertSame(1_100_000, (int) $ringkasan->getCell('B10')->getValue());

        $bbm = $book->getSheetByName('BBM');
        $this->assertSame(['Tanggal', 'Plat', 'Pemilik', 'Jenis BBM', 'Odometer (km)', 'Liter', 'Harga/L', 'Total bayar', 'Isi', 'SPBU'],
            $bbm->rangeToArray('A1:J1')[0]);
        $this->assertSame('B 2 BBB', $bbm->getCell('B2')->getValue());

        $perBulan = $book->getSheetByName('Per Bulan');
        $this->assertSame('Pengisian BBM', $perBulan->getCell('C1')->getValue());

        // Tanpa BBM: sheet BBM tidak ada.
        $res = $this->get('/api/reports/costs/export?from=2026-01-01&to=2026-03-31&include_fuel=0', ['Accept' => 'application/json'])->assertOk();
        $book = IOFactory::load($res->baseResponse->getFile()->getPathname());
        $this->assertNotContains('BBM', $book->getSheetNames());
        $this->assertSame('tidak disertakan', $book->getSheetByName('Ringkasan')->getCell('B10')->getValue());
    }
}
