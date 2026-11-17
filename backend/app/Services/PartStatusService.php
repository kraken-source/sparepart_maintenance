<?php

namespace App\Services;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\Vehicle;
use App\Support\PartLife;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Status setiap part untuk satu kendaraan. Dipakai oleh dashboard (warna 3D)
 * dan pemeriksa pengingat jatuh tempo, agar keduanya selalu konsisten.
 */
class PartStatusService
{
    /** @return Collection<int, array<string, mixed>> */
    public function forVehicle(Vehicle $vehicle, ?Carbon $today = null): Collection
    {
        $today ??= Carbon::today();

        // Catatan penggantian terakhir per part (keyBy menimpa → tersisa yang paling akhir).
        $last = MaintenanceRecord::where('vehicle_id', $vehicle->id)
            ->where('action', 'replace')
            ->orderBy('service_date')
            ->orderBy('id')
            ->get()
            ->keyBy('part_id');

        $counts = MaintenanceRecord::where('vehicle_id', $vehicle->id)
            ->selectRaw('part_id, count(*) as total')
            ->groupBy('part_id')
            ->pluck('total', 'part_id');

        return Part::orderBy('category')->orderBy('name')->get()->map(function (Part $part) use ($vehicle, $last, $counts, $today) {
            $record = $last->get($part->id);
            $life = $record ? PartLife::evaluate($record, $part, $vehicle->odometer, $today) : null;

            return [
                'id' => $part->id,
                'name' => $part->name,
                'category' => $part->category,
                'mesh_name' => $part->mesh_name,
                'interval_km' => $part->interval_km,
                'interval_days' => $part->interval_days,
                'status' => $life['status'] ?? 'unknown',
                'last_service_date' => $record?->service_date?->toDateString(),
                'last_odometer' => $record?->odometer,
                // Usia pakai yang berlaku: dari catatan terakhir ('record') atau default part ('part')
                'life_source' => $life['source'] ?? null,
                'life_km' => $life['life_km'] ?? null,
                'life_months' => $life['life_months'] ?? null,
                'life_days' => $life['life_days'] ?? null,
                'next_km' => $life['next_km'] ?? null,
                'next_service_date' => $life['next_date'] ?? null,
                'remaining_km' => $life['remaining_km'] ?? null,
                'remaining_days' => $life['remaining_days'] ?? null,
                'used_ratio' => $life['used_ratio'] ?? null,
                'record_count' => (int) ($counts[$part->id] ?? 0),
            ];
        });
    }

    /** "Lewat 153 hari" / "Sisa 2.500 km · 960 hari" – sama dengan remainingText() di frontend. */
    public static function remainingText(array $p): string
    {
        $km = $p['remaining_km'];
        $days = $p['remaining_days'];
        $late = ($km !== null && $km <= 0) || ($days !== null && $days <= 0);

        $parts = array_filter([
            $km !== null ? number_format(abs($km), 0, ',', '.').' km' : null,
            $days !== null ? abs($days).' hari' : null,
        ]);

        return $parts ? ($late ? 'Lewat ' : 'Sisa ').implode(' · ', $parts) : '';
    }
}
