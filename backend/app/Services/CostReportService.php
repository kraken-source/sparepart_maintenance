<?php

namespace App\Services;

use App\Models\FuelLog;
use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Laporan biaya kendaraan (maintenance + bahan bakar) untuk satu rentang tanggal.
 * Dipakai oleh halaman laporan dan export Excel agar angkanya selalu sama.
 *
 * Biaya BBM digabung sebagai kategori "Bahan Bakar" di total, per bulan, per kategori,
 * per kendaraan, dan per pemilik – sehingga terlihat total biaya kendaraan. Bagian yang khusus
 * maintenance (10 part terbesar, rincian catatan) tetap terpisah, dan BBM punya bagian sendiri.
 *
 * Agregasi dilakukan di PHP (bukan SQL) supaya tidak bergantung pada fungsi tanggal
 * yang berbeda antara SQLite dan MySQL; jumlah catatan per kendaraan relatif kecil.
 */
class CostReportService
{
    /** Nama kategori biaya BBM. Selalu di urutan terakhir agar warna kategori part tidak bergeser. */
    public const FUEL_CATEGORY = 'Bahan Bakar';

    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public function __construct(private FuelEconomyService $economy) {}

    /**
     * $viewer: batasi ke kendaraan yang boleh dilihat user tsb. Null = semua (mis. dari terminal).
     * $ownerId: hanya kendaraan milik user tsb (filter admin).
     * $includeFuel: gabungkan biaya bahan bakar (default ya).
     * Data pemilik hanya disertakan untuk admin / tanpa viewer; user biasa hanya melihat miliknya sendiri.
     */
    public function build(
        Carbon $from, Carbon $to, ?int $vehicleId = null, ?User $viewer = null, ?int $ownerId = null, bool $includeFuel = true,
    ): array {
        $withOwners = ! $viewer || $viewer->isAdmin();

        // Filter yang sama untuk catatan maintenance & pengisian BBM.
        $scope = fn (Builder $q, string $dateColumn) => $q
            ->whereDate($dateColumn, '>=', $from->toDateString())
            ->whereDate($dateColumn, '<=', $to->toDateString())
            ->when($vehicleId, fn ($q) => $q->where('vehicle_id', $vehicleId))
            ->when($ownerId, fn ($q) => $q->whereIn('vehicle_id', Vehicle::where('user_id', $ownerId)->select('id')))
            ->when($viewer, fn ($q) => $q->whereIn('vehicle_id', Vehicle::visibleTo($viewer)->select('id')));
        $vehicleRelations = ['vehicle:id,plate_number,brand,model,user_id', 'vehicle.owner:id,name,email'];

        $records = $scope(MaintenanceRecord::query(), 'service_date')
            ->with(['part:id,name,category', ...$vehicleRelations])
            ->orderBy('service_date')->orderBy('id')
            ->get();
        $fuelLogs = $includeFuel
            ? $scope(FuelLog::query(), 'filled_on')->with(['fuelType:id,name,group,rating', ...$vehicleRelations])
                ->orderBy('filled_on')->orderBy('id')->get()
            : collect();

        // Semua biaya sebagai satu daftar: maintenance (kategori part) + BBM (kategori "Bahan Bakar").
        $items = $records->map(fn ($r) => [
            'kind' => 'maintenance', 'date' => $r->service_date->toDateString(), 'category' => $r->part->category,
            'vehicle_id' => $r->vehicle_id, 'vehicle' => $r->vehicle, 'cost' => (int) $r->cost,
        ])->concat($fuelLogs->map(fn ($l) => [
            'kind' => 'fuel', 'date' => $l->filled_on, 'category' => self::FUEL_CATEGORY,
            'vehicle_id' => $l->vehicle_id, 'vehicle' => $l->vehicle, 'cost' => $l->total_cost,
        ]));

        // Kategori: master Part (urutan tetap, alfabetis) + "Bahan Bakar" di akhir → warna grafik
        // mengikuti kategori, tidak berubah saat filter mengubah kategori mana yang muncul.
        $categories = Part::query()->distinct()->orderBy('category')->pluck('category')
            ->when($includeFuel, fn ($c) => $c->push(self::FUEL_CATEGORY))
            ->values();

        $total = (int) $items->sum('cost');
        $monthly = $this->monthly($items, $from, $to, $categories);
        $byCategory = $this->groupTotals($items, fn ($i) => $i['category'], $total)
            ->map(fn ($g, $key) => ['category' => $key] + $g)->values();

        return [
            'filter' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'vehicle' => $vehicleId ? Vehicle::find($vehicleId)?->only(['id', 'plate_number', 'brand', 'model']) : null,
                'owner' => $ownerId ? User::find($ownerId)?->only(['id', 'name', 'email']) : null,
                'include_fuel' => $includeFuel,
            ],
            'with_owners' => $withOwners,
            'categories' => $categories,
            'summary' => [
                'total' => $total,
                'maintenance_total' => (int) $records->sum('cost'),
                'fuel_total' => (int) $fuelLogs->sum('total_cost'),
                'count' => $records->count(),          // catatan maintenance
                'fuel_fills' => $fuelLogs->count(),    // pengisian BBM
                'months' => count($monthly),
                'avg_per_month' => count($monthly) ? (int) round($total / count($monthly)) : 0,
                'top_category' => $byCategory->first(),
            ],
            'monthly' => $monthly,
            'by_category' => $byCategory,
            'by_vehicle' => $this->groupTotals($items, fn ($i) => $i['vehicle_id'], $total)
                ->map(function ($g, $id) use ($items, $fuelLogs, $withOwners) {
                    $own = $items->where('vehicle_id', $id);
                    $v = $own->first()['vehicle'];
                    $fuel = $fuelLogs->where('vehicle_id', $id);
                    // Konsumsi dihitung dari pengisian di dalam periode saja.
                    $economy = $fuel->isNotEmpty() ? $this->economy->analyse($fuel)['summary'] : null;

                    return ['vehicle_id' => $id, 'plate_number' => $v->plate_number, 'name' => trim("{$v->brand} {$v->model}")]
                        + ($withOwners ? ['owner_id' => $v->user_id, 'owner' => $v->owner?->name] : [])
                        + $this->split($own, $g) + [
                            'fuel_liters' => round((float) $fuel->sum('liters'), 2),
                            'km_per_liter' => $economy['avg_km_per_liter'] ?? null,
                        ];
                })->values(),
            // Biaya per pemilik (admin): total, jumlah kendaraan yang punya biaya, kendaraan termahal.
            'by_owner' => $withOwners
                ? $this->groupTotals($items, fn ($i) => $i['vehicle']->user_id, $total)
                    ->map(function ($g, $id) use ($items) {
                        $own = $items->filter(fn ($i) => $i['vehicle']->user_id === $id);
                        $owner = $own->first()['vehicle']->owner;
                        $perVehicle = $own->groupBy('vehicle_id')->map(fn ($is) => (int) $is->sum('cost'))->sortDesc();

                        return [
                            'owner_id' => $id,
                            'name' => $owner?->name ?? '(tanpa pemilik)',
                            'email' => $owner?->email,
                            'vehicles' => $perVehicle->count(),
                            'top_vehicle' => $own->firstWhere('vehicle_id', $perVehicle->keys()->first())['vehicle']->plate_number,
                        ] + $this->split($own, $g);
                    })->values()
                : null,
            // ----- khusus maintenance -----
            'by_part' => $this->groupTotals($records, fn ($r) => $r->part_id, (int) $records->sum('cost'))
                ->map(function ($g, $id) use ($records) {
                    $p = $records->firstWhere('part_id', $id)->part;

                    return ['part_id' => $id, 'name' => $p->name, 'category' => $p->category] + $g;
                })->take(10)->values(),
            'records' => $records->sortByDesc(fn ($r) => $r->service_date->toDateString().sprintf('%010d', $r->id))
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'service_date' => $r->service_date->toDateString(),
                    'plate_number' => $r->vehicle->plate_number,
                    'owner' => $withOwners ? $r->vehicle->owner?->name : null,
                    'part' => $r->part->name,
                    'category' => $r->part->category,
                    'action' => $r->action,
                    'odometer' => $r->odometer,
                    'part_brand' => $r->part_brand,
                    'workshop' => $r->workshop,
                    'cost' => (int) $r->cost,
                ])->values(),
            // ----- khusus bahan bakar -----
            'fuel' => $includeFuel ? $this->fuelSection($fuelLogs, $withOwners) : null,
        ];
    }

    private function fuelSection(Collection $logs, bool $withOwners): array
    {
        $total = (int) $logs->sum('total_cost');
        $liters = round((float) $logs->sum('liters'), 2);

        return [
            'total' => $total,
            'liters' => $liters,
            'fills' => $logs->count(),
            'avg_price_per_liter' => $liters > 0 ? (int) round($total / $liters) : null,
            'by_type' => $logs->groupBy('fuel_type_id')
                ->map(fn (Collection $g) => [
                    'fuel_type_id' => $g->first()->fuel_type_id,
                    'name' => $g->first()->fuelType?->name,
                    'liters' => round((float) $g->sum('liters'), 2),
                    'fills' => $g->count(),
                    'total' => (int) $g->sum('total_cost'),
                    'share' => $total ? round($g->sum('total_cost') / $total, 4) : 0,
                ])
                ->sortByDesc('total')->values(),
            'records' => $logs->sortByDesc(fn ($l) => $l->filled_on.sprintf('%010d', $l->id))
                ->map(fn ($l) => [
                    'id' => $l->id,
                    'filled_on' => $l->filled_on,
                    'plate_number' => $l->vehicle->plate_number,
                    'owner' => $withOwners ? $l->vehicle->owner?->name : null,
                    'fuel_type' => $l->fuelType?->name,
                    'odometer' => $l->odometer,
                    'liters' => $l->liters,
                    'price_per_liter' => $l->price_per_liter,
                    'total_cost' => $l->total_cost,
                    'is_full' => $l->is_full,
                    'station' => $l->station,
                ])->values(),
        ];
    }

    /** Total per bulan (semua bulan dalam rentang, termasuk yang nol), dipecah per kategori. */
    private function monthly(Collection $items, Carbon $from, Carbon $to, Collection $categories): array
    {
        $empty = $categories->mapWithKeys(fn ($c) => [$c => 0])->all();
        $months = [];
        for ($m = $from->copy()->startOfMonth(); $m->lte($to); $m->addMonthNoOverflow()) {
            $months[$m->format('Y-m')] = [
                'month' => $m->format('Y-m'),
                'label' => self::MONTHS[$m->month - 1].' '.$m->year,
                'total' => 0,
                'count' => 0,       // catatan maintenance
                'fuel_fills' => 0,  // pengisian BBM
                'by_category' => $empty,
            ];
        }

        foreach ($items as $i) {
            $key = substr($i['date'], 0, 7);
            $months[$key]['total'] += $i['cost'];
            $months[$key][$i['kind'] === 'fuel' ? 'fuel_fills' : 'count']++;
            $months[$key]['by_category'][$i['category']] = ($months[$key]['by_category'][$i['category']] ?? 0) + $i['cost'];
        }

        return array_values($months);
    }

    /**
     * Total grup dipecah maintenance vs BBM. "count" = jumlah catatan maintenance,
     * "fuel_fills" = jumlah pengisian BBM (agar label "N catatan" di UI tetap benar).
     */
    private function split(Collection $items, array $group): array
    {
        $maintenance = $items->where('kind', 'maintenance');
        $fuel = $items->where('kind', 'fuel');

        return array_merge($group, [
            'count' => $maintenance->count(),
            'fuel_fills' => $fuel->count(),
            'maintenance' => (int) $maintenance->sum('cost'),
            'fuel' => (int) $fuel->sum('cost'),
        ]);
    }

    /** Kelompokkan & jumlahkan biaya, urut dari terbesar, plus pangsa terhadap total. */
    private function groupTotals(Collection $items, callable $key, int $total): Collection
    {
        return $items->groupBy($key)
            ->map(fn (Collection $g) => [
                'total' => (int) $g->sum('cost'),
                'count' => $g->count(),
                'share' => $total ? round($g->sum('cost') / $total, 4) : 0,
            ])
            ->sortByDesc('total');
    }
}
