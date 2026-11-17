<?php

namespace Tests\Unit;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Support\PartLife;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Perhitungan jadwal ganti berikutnya (km / waktu, mana yang lebih dulu).
 */
class PartLifeTest extends TestCase
{
    private function part(?int $km = 10000, ?int $days = 180): Part
    {
        return new Part(['name' => 'Oli', 'category' => 'Mesin', 'mesh_name' => 'engine_oil', 'interval_km' => $km, 'interval_days' => $days]);
    }

    private function record(array $attrs = []): MaintenanceRecord
    {
        return new MaintenanceRecord(array_merge([
            'action' => 'replace', 'service_date' => '2026-01-01', 'odometer' => 40000,
        ], $attrs));
    }

    #[Test]
    public function memakai_interval_default_part_bila_catatan_tidak_punya_usia_pakai(): void
    {
        $r = PartLife::evaluate($this->record(), $this->part(), 45000, Carbon::parse('2026-03-01'));

        $this->assertSame('part', $r['source']);
        $this->assertSame(50000, $r['next_km']);
        $this->assertSame(5000, $r['remaining_km']);
        $this->assertSame('2026-06-30', $r['next_date']); // 1 Jan + 180 hari
        $this->assertSame(121, $r['remaining_days']);
        $this->assertSame('ok', $r['status']);
        $this->assertSame(0.5, $r['used_ratio']); // km paling habis: 5.000 dari 10.000
    }

    #[Test]
    public function usia_pakai_di_catatan_menimpa_default_part(): void
    {
        $r = PartLife::evaluate($this->record(['life_km' => 5000, 'life_months' => 6]), $this->part(), 42000, Carbon::parse('2026-02-01'));

        $this->assertSame('record', $r['source']);
        $this->assertSame(45000, $r['next_km']);
        $this->assertSame('2026-07-01', $r['next_date']);
        $this->assertNull($r['life_days']);
    }

    #[Test]
    public function hanya_km_di_catatan_berarti_tidak_ada_batas_waktu(): void
    {
        $r = PartLife::evaluate($this->record(['life_km' => 5000]), $this->part(), 42000, Carbon::parse('2030-01-01'));

        $this->assertNull($r['next_date']);
        $this->assertSame('ok', $r['status'], 'Bertahun-tahun kemudian tetap aman karena hanya dibatasi km');
    }

    #[Test]
    public function status_segera_pada_sisa_15_persen(): void
    {
        $today = Carbon::parse('2026-02-01');
        $this->assertSame('due_soon', PartLife::evaluate($this->record(), $this->part(), 48500, $today)['status']); // sisa 15%
        $this->assertSame('ok', PartLife::evaluate($this->record(), $this->part(), 48400, $today)['status']); // sisa 16%
    }

    #[Test]
    public function lewat_jadwal_bila_salah_satu_batas_terlewati(): void
    {
        // km terlewati, waktu masih lama
        $this->assertSame('overdue', PartLife::evaluate($this->record(), $this->part(), 50000, Carbon::parse('2026-02-01'))['status']);
        // waktu terlewati, km masih jauh
        $r = PartLife::evaluate($this->record(), $this->part(), 41000, Carbon::parse('2026-08-01'));
        $this->assertSame('overdue', $r['status']);
        $this->assertLessThan(0, $r['remaining_days']);
        $this->assertGreaterThan(1, $r['used_ratio']);
    }

    #[Test]
    public function penambahan_bulan_tidak_meluber_ke_bulan_berikutnya(): void
    {
        $r = PartLife::evaluate($this->record(['service_date' => '2026-01-31', 'life_months' => 1]), $this->part(), 40000, Carbon::parse('2026-02-01'));
        $this->assertSame('2026-02-28', $r['next_date']);

        $r = PartLife::evaluate($this->record(['service_date' => '2024-01-31', 'life_months' => 1]), $this->part(), 40000, Carbon::parse('2024-02-01'));
        $this->assertSame('2024-02-29', $r['next_date'], 'Tahun kabisat');
    }

    #[Test]
    public function part_tanpa_interval_dianggap_aman_sesuai_kondisi(): void
    {
        $r = PartLife::evaluate($this->record(), $this->part(null, null), 99999, Carbon::parse('2030-01-01'));

        $this->assertSame('ok', $r['status']);
        $this->assertNull($r['next_km']);
        $this->assertNull($r['next_date']);
        $this->assertNull($r['used_ratio']);
    }
}
