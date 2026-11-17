<?php

namespace App\Services;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Laporan biaya maintenance untuk satu rentang tanggal (opsional satu kendaraan).
 * Dipakai oleh halaman laporan dan export Excel agar angkanya selalu sama.
 *
 * Agregasi dilakukan di PHP (bukan SQL) supaya tidak bergantung pada fungsi tanggal
 * yang berbeda antara SQLite dan MySQL; jumlah catatan per kendaraan relatif kecil.
 */
class CostReportService
{
    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    /** $viewer: batasi ke kendaraan yang boleh dilihat user tsb. Null = semua (mis. dari terminal). */
    public function build(Carbon $from, Carbon $to, ?int $vehicleId = null, ?User $viewer = null): array
    {
        $records = MaintenanceRecord::query()
            ->with(['part:id,name,category', 'vehicle:id,plate_number,brand,model'])
            ->whereDate('service_date', '>=', $from->toDateString())
            ->whereDate('service_date', '<=', $to->toDateString())
            ->when($vehicleId, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($viewer, fn ($q) => $q->whereIn('vehicle_id', Vehicle::visibleTo($viewer)->select('id')))
            ->orderBy('service_date')
            ->orderBy('id')
            ->get();

        // Semua kategori di master Part, urutan tetap (alfabetis) → warna di grafik mengikuti
        // kategori, tidak berubah saat filter mengubah kategori mana yang muncul.
        $categories = Part::query()->distinct()->orderBy('category')->pluck('category')->values();

        $total = (int) $records->sum('cost');
        $monthly = $this->monthly($records, $from, $to, $categories);
        $byCategory = $this->groupTotals($records, fn ($r) => $r->part->category, $total)
            ->map(fn ($g, $key) => ['category' => $key] + $g)->values();

        return [
            'filter' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'vehicle' => $vehicleId ? Vehicle::find($vehicleId)?->only(['id', 'plate_number', 'brand', 'model']) : null,
            ],
            'categories' => $categories,
            'summary' => [
                'total' => $total,
                'count' => $records->count(),
                'months' => count($monthly),
                'avg_per_month' => count($monthly) ? (int) round($total / count($monthly)) : 0,
                'top_category' => $byCategory->first(),
            ],
            'monthly' => $monthly,
            'by_category' => $byCategory,
            'by_vehicle' => $this->groupTotals($records, fn ($r) => $r->vehicle_id, $total)
                ->map(function ($g, $id) use ($records) {
                    $v = $records->firstWhere('vehicle_id', $id)->vehicle;

                    return ['vehicle_id' => $id, 'plate_number' => $v->plate_number, 'name' => trim("{$v->brand} {$v->model}")] + $g;
                })->values(),
            'by_part' => $this->groupTotals($records, fn ($r) => $r->part_id, $total)
                ->map(function ($g, $id) use ($records) {
                    $p = $records->firstWhere('part_id', $id)->part;

                    return ['part_id' => $id, 'name' => $p->name, 'category' => $p->category] + $g;
                })->take(10)->values(),
            'records' => $records->sortByDesc(fn ($r) => $r->service_date->toDateString().sprintf('%010d', $r->id))
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'service_date' => $r->service_date->toDateString(),
                    'plate_number' => $r->vehicle->plate_number,
                    'part' => $r->part->name,
                    'category' => $r->part->category,
                    'action' => $r->action,
                    'odometer' => $r->odometer,
                    'part_brand' => $r->part_brand,
                    'workshop' => $r->workshop,
                    'cost' => (int) $r->cost,
                ])->values(),
        ];
    }

    /** Total per bulan (semua bulan dalam rentang, termasuk yang nol), dipecah per kategori. */
    private function monthly(Collection $records, Carbon $from, Carbon $to, Collection $categories): array
    {
        $empty = $categories->mapWithKeys(fn ($c) => [$c => 0])->all();
        $months = [];
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonthNoOverflow()) {
            $months[$m->format('Y-m')] = [
                'month' => $m->format('Y-m'),
                'label' => self::MONTHS[$m->month - 1].' '.$m->year,
                'total' => 0,
                'count' => 0,
                'by_category' => $empty,
            ];
        }

        foreach ($records as $r) {
            $key = $r->service_date->format('Y-m');
            $months[$key]['total'] += (int) $r->cost;
            $months[$key]['count']++;
            $months[$key]['by_category'][$r->part->category] = ($months[$key]['by_category'][$r->part->category] ?? 0) + (int) $r->cost;
        }

        return array_values($months);
    }

    /** Kelompokkan & jumlahkan biaya, urut dari terbesar, plus pangsa terhadap total. */
    private function groupTotals(Collection $records, callable $key, int $total): Collection
    {
        return $records->groupBy($key)
            ->map(fn (Collection $g) => [
                'total' => (int) $g->sum('cost'),
                'count' => $g->count(),
                'share' => $total ? round($g->sum('cost') / $total, 4) : 0,
            ])
            ->sortByDesc('total');
    }
}
