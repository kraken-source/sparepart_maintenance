<?php

namespace Tests\Feature;

use App\Models\FuelLog;
use App\Models\FuelType;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Perhitungan konsumsi BBM metode tangki penuh ke tangki penuh (FuelEconomyService)
 * lewat GET /api/fuel-logs?vehicle_id=.
 */
class FuelEconomyTest extends TestCase
{
    use RefreshDatabase;

    private Vehicle $car;

    private FuelType $pertalite;

    private FuelType $pertamax;

    protected function setUp(): void
    {
        parent::setUp();
        $user = $this->actingAsUser();
        $this->car = Vehicle::factory()->for($user, 'owner')->create(['odometer' => 10000]);
        $this->pertalite = FuelType::where('name', 'Pertalite')->firstOrFail();
        $this->pertamax = FuelType::where('name', 'Pertamax')->firstOrFail();
    }

    private function fill(int $odometer, float $liters, bool $full = true, array $extra = []): FuelLog
    {
        return FuelLog::factory()->for($this->car)->create(array_merge([
            'fuel_type_id' => $this->pertalite->id,
            'filled_on' => '2026-11-01',
            'odometer' => $odometer,
            'liters' => $liters,
            'price_per_liter' => 10000,
            'total_cost' => (int) round($liters * 10000),
            'is_full' => $full,
        ], $extra));
    }

    private function economy(): array
    {
        return $this->getJson("/api/fuel-logs?vehicle_id={$this->car->id}")->assertOk()->json('data');
    }

    private function statuses(array $d): array
    {
        // Riwayat dikirim terbaru di atas; dibalik agar urut sesuai odometer.
        return array_column(array_reverse($d['logs']), 'status', 'odometer');
    }

    #[Test]
    public function contoh_analisis_isi_sebagian_diakumulasi_ke_isi_penuh_berikutnya(): void
    {
        $this->fill(10000, 40);           // titik awal
        $this->fill(10250, 15, false);    // sebagian
        $this->fill(10520, 30);           // penuh → (10520-10000) / (15+30)

        $d = $this->economy();

        $this->assertSame([10000 => 'baseline', 10250 => 'partial', 10520 => 'computed'], $this->statuses($d));
        $closing = $d['logs'][0];
        $this->assertSame(520, $closing['segment']['distance']);
        $this->assertEquals(45, $closing['segment']['liters']);
        $this->assertEquals(11.56, $closing['segment']['km_per_liter']);
        $this->assertSame(270, $closing['distance'], 'jarak dari pengisian sebelumnya');
        $this->assertEquals(11.56, $d['summary']['avg_km_per_liter']);
        $this->assertEquals(85, $d['summary']['total_liters'], 'total liter mencakup titik awal');
        $this->assertSame(850_000, $d['summary']['total_cost']);
        $this->assertEquals(865.4, $d['summary']['avg_cost_per_km'], '450.000 / 520 km');
    }

    #[Test]
    public function rata_rata_keseluruhan_adalah_total_km_dibagi_total_liter(): void
    {
        $this->fill(10000, 40);
        $this->fill(10100, 20);   // 100 km / 20 L = 5
        $this->fill(10700, 40);   // 600 km / 40 L = 15

        $s = $this->economy()['summary'];

        $this->assertEquals(11.67, $s['avg_km_per_liter'], '700 km / 60 L, bukan (5 + 15) / 2 = 10');
        $this->assertSame(2, $s['segments']);
        $this->assertEquals(15, $s['last_km_per_liter']);
        $this->assertEquals(15, $s['best_km_per_liter']);
        $this->assertEquals(5, $s['worst_km_per_liter']);
    }

    #[Test]
    public function pengisian_terlewat_memutus_rantai(): void
    {
        $this->fill(10000, 40);
        $this->fill(10400, 30, true, ['missed_previous' => true]); // ada isi yang tidak dicatat → titik awal baru
        $this->fill(10800, 32);                                    // 400 / 32 = 12.5

        $d = $this->economy();

        $this->assertSame([10000 => 'baseline', 10400 => 'baseline', 10800 => 'computed'], $this->statuses($d));
        $this->assertSame(1, $d['summary']['segments']);
        $this->assertEquals(12.5, $d['summary']['avg_km_per_liter']);
    }

    #[Test]
    public function isi_sebagian_sebelum_ada_titik_awal_tidak_bisa_dihitung(): void
    {
        $this->fill(9800, 10, false);
        $this->fill(10000, 40);

        $this->assertSame([9800 => 'unusable', 10000 => 'baseline'], $this->statuses($this->economy()));
        $this->assertNull($this->economy()['summary']['avg_km_per_liter']);
    }

    #[Test]
    public function catatan_lama_disisipkan_tetap_diurutkan_menurut_odometer(): void
    {
        $this->fill(10500, 50, true, ['filled_on' => '2026-11-10']);
        $this->fill(10000, 40, true, ['filled_on' => '2026-11-01']); // dimasukkan belakangan

        $d = $this->economy();
        $this->assertSame([10000 => 'baseline', 10500 => 'computed'], $this->statuses($d));
        $this->assertEquals(10, $d['summary']['avg_km_per_liter']);
    }

    #[Test]
    public function konsumsi_per_jenis_bbm_memakai_bbm_yang_ada_di_tangki(): void
    {
        $this->fill(10000, 40);                                                       // tangki: Pertalite
        $this->fill(10400, 40, true, ['fuel_type_id' => $this->pertamax->id]);        // 400/40 = 10 → Pertalite; tangki kini Pertamax
        $this->fill(10900, 40);                                                       // 500/40 = 12.5 → Pertamax
        $this->fill(11100, 10, false, ['fuel_type_id' => $this->pertamax->id]);       // tangki campur Pertalite + Pertamax
        $this->fill(11400, 20);                                                       // 500/30 → campuran

        $types = collect($this->economy()['by_fuel_type'])->keyBy('name');

        $this->assertEquals(10, $types['Pertalite']['km_per_liter']);
        $this->assertSame(1, $types['Pertalite']['segments']);
        $this->assertEquals(12.5, $types['Pertamax']['km_per_liter']);
        $this->assertSame(1, $types['Pertamax']['segments'], 'segmen campuran tidak dihitung per jenis');
        $this->assertSame(3, $types['Pertalite']['fills']);
        $this->assertEquals(100, $types['Pertalite']['liters']);
    }

    #[Test]
    public function belum_ada_catatan(): void
    {
        $d = $this->economy();

        $this->assertSame([], $d['logs']);
        $this->assertSame(0, $d['summary']['fills']);
        $this->assertNull($d['summary']['avg_km_per_liter']);
    }
}
