<?php

namespace App\Services;

use App\Models\FuelLog;
use App\Models\Vehicle;
use Illuminate\Support\Collection;

/**
 * Konsumsi bahan bakar dengan metode "tangki penuh ke tangki penuh" (full-to-full).
 *
 *   Isi penuh di A (titik awal) → isi sebagian … → isi penuh di B
 *   km/L segmen = (odometer B − odometer A) ÷ (liter semua pengisian SETELAH A sampai B)
 *
 * Liter yang diisi di B adalah jumlah yang terpakai sejak tangki penuh di A, jadi hasilnya
 * akurat tanpa perlu tahu isi tangki. Pengisian sebagian diakumulasi ke segmen berikutnya.
 *
 * Status tiap pengisian:
 *  - baseline : isi penuh yang menjadi titik awal (pertama kali, atau setelah rantai terputus)
 *  - partial  : isi sebagian; liternya dihitung saat isi penuh berikutnya
 *  - computed : isi penuh yang menutup segmen → punya hasil km/L
 *  - unusable : isi sebagian sebelum ada titik awal → tidak bisa dihitung
 *  - invalid  : isi penuh tapi jarak/liter tidak masuk akal (mis. odometer sama) → titik awal baru
 *
 * "missed_previous" (ada pengisian yang tidak dicatat) memutus rantai: segmen yang sedang
 * berjalan dibuang karena liternya tidak lengkap.
 *
 * Jenis BBM per segmen = jenis bahan bakar yang ada di tangki selama segmen tsb, yaitu jenis
 * pada titik awal dan pengisian sebagian di dalamnya. Bila campur, segmen tidak dipakai untuk
 * perbandingan per jenis (tetap dihitung untuk rata-rata keseluruhan).
 *
 * Tidak ada yang disimpan: semuanya dihitung ulang dari catatan, jadi edit / hapus catatan lama
 * langsung tercermin.
 */
class FuelEconomyService
{
    public function forVehicle(Vehicle $vehicle): array
    {
        $logs = $vehicle->fuelLogs()->with('fuelType:id,name,group,rating')->get();

        return $this->analyse($logs);
    }

    /** @param  Collection<int, FuelLog>  $logs */
    public function analyse(Collection $logs): array
    {
        // Urut menurut odometer (bukan tanggal input) – catatan lama boleh dimasukkan belakangan.
        $logs = $logs->sortBy([['odometer', 'asc'], ['filled_on', 'asc'], ['id', 'asc']])->values();

        $rows = [];
        $segments = [];
        $anchor = null;      // pengisian penuh terakhir (titik awal segmen berjalan)
        $acc = $this->emptyAccumulator();
        $previous = null;

        foreach ($logs as $log) {
            $row = $log->toArray() + [
                'distance' => $previous ? $log->odometer - $previous->odometer : null, // jarak dari pengisian sebelumnya
                'status' => null,
                'segment' => null,
            ];
            $previous = $log;

            if ($log->missed_previous) {
                $anchor = null; // rantai terputus
            }

            if ($anchor === null) {
                $row['status'] = $log->is_full ? 'baseline' : 'unusable';
                if ($log->is_full) {
                    $anchor = $log;
                    $acc = $this->emptyAccumulator($log->fuel_type_id);
                }
                $rows[] = $row;

                continue;
            }

            $acc['liters'] += $log->liters;
            $acc['cost'] += $log->total_cost;
            $acc['fills']++;

            if (! $log->is_full) {
                $acc['types'][$log->fuel_type_id] = true; // BBM ini ikut terbakar di segmen
                $row['status'] = 'partial';
                $rows[] = $row;

                continue;
            }

            $distance = $log->odometer - $anchor->odometer;
            if ($distance <= 0 || $acc['liters'] <= 0) {
                $row['status'] = 'invalid';
            } else {
                $types = array_keys($acc['types']);
                $segment = [
                    'from_odometer' => $anchor->odometer,
                    'distance' => $distance,
                    'liters' => round($acc['liters'], 2),
                    'cost' => $acc['cost'],
                    'fills' => $acc['fills'],
                    'km_per_liter' => round($distance / $acc['liters'], 2),
                    'cost_per_km' => round($acc['cost'] / $distance, 1),
                    'fuel_type_id' => count($types) === 1 ? $types[0] : null, // null = campuran
                ];
                $segments[] = $segment;
                $row['status'] = 'computed';
                $row['segment'] = $segment;
            }

            $anchor = $log;
            $acc = $this->emptyAccumulator($log->fuel_type_id);
            $rows[] = $row;
        }

        return [
            'summary' => $this->summary($logs, $segments),
            'by_fuel_type' => $this->byFuelType($logs, $segments),
            // Terbaru di atas untuk tampilan riwayat.
            'logs' => array_reverse($rows),
        ];
    }

    private function emptyAccumulator(?int $fuelTypeId = null): array
    {
        return ['liters' => 0.0, 'cost' => 0, 'fills' => 0, 'types' => $fuelTypeId ? [$fuelTypeId => true] : []];
    }

    private function summary(Collection $logs, array $segments): array
    {
        $distance = array_sum(array_column($segments, 'distance'));
        $liters = array_sum(array_column($segments, 'liters'));
        $cost = array_sum(array_column($segments, 'cost'));
        $economies = array_column($segments, 'km_per_liter');
        $totalLiters = round((float) $logs->sum('liters'), 2);
        $totalCost = (int) $logs->sum('total_cost');

        return [
            'fills' => $logs->count(),
            'total_liters' => $totalLiters,
            'total_cost' => $totalCost,
            'avg_price_per_liter' => $totalLiters > 0 ? (int) round($totalCost / $totalLiters) : null,
            'first_date' => $logs->min('filled_on'),
            'last_date' => $logs->max('filled_on'),
            'odometer_span' => $logs->count() > 1 ? $logs->max('odometer') - $logs->min('odometer') : 0,
            // Rata-rata keseluruhan = total km ÷ total liter dari segmen yang valid
            // (bukan rata-rata angka tiap segmen, agar segmen pendek tidak berbobot sama).
            'segments' => count($segments),
            'measured_distance' => $distance,
            'measured_liters' => round($liters, 2),
            'avg_km_per_liter' => $liters > 0 ? round($distance / $liters, 2) : null,
            'avg_cost_per_km' => $distance > 0 ? round($cost / $distance, 1) : null,
            'last_km_per_liter' => $segments ? end($segments)['km_per_liter'] : null,
            'best_km_per_liter' => $economies ? max($economies) : null,
            'worst_km_per_liter' => $economies ? min($economies) : null,
        ];
    }

    /** Per jenis BBM: jumlah pengisian, liter, biaya, dan km/L dari segmen yang murni jenis tsb. */
    private function byFuelType(Collection $logs, array $segments): array
    {
        return $logs->groupBy('fuel_type_id')
            ->map(function (Collection $group, $typeId) use ($segments) {
                $own = array_values(array_filter($segments, fn ($s) => $s['fuel_type_id'] === (int) $typeId));
                $distance = array_sum(array_column($own, 'distance'));
                $liters = array_sum(array_column($own, 'liters'));
                $type = $group->first()->fuelType;

                return [
                    'fuel_type_id' => (int) $typeId,
                    'name' => $type?->name,
                    'group' => $type?->group,
                    'rating' => $type?->rating,
                    'fills' => $group->count(),
                    'liters' => round((float) $group->sum('liters'), 2),
                    'cost' => (int) $group->sum('total_cost'),
                    'avg_price_per_liter' => (int) round($group->sum('total_cost') / max($group->sum('liters'), 0.01)),
                    'segments' => count($own),
                    'km_per_liter' => $liters > 0 ? round($distance / $liters, 2) : null,
                ];
            })
            ->sortByDesc('liters')
            ->values()
            ->all();
    }
}
