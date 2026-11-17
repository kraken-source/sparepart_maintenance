<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VehicleRequest;
use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\Vehicle;
use App\Support\PartLife;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class VehicleController extends Controller
{
    public function index(): JsonResponse
    {
        $vehicles = Vehicle::withCount('maintenanceRecords')
            ->withMax('maintenanceRecords', 'odometer')
            ->orderBy('plate_number')
            ->get();

        return response()->json(['data' => $vehicles]);
    }

    public function store(VehicleRequest $request): JsonResponse
    {
        return response()->json(['data' => Vehicle::create($request->validated())], 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        return response()->json(['data' => $vehicle->loadCount('maintenanceRecords')]);
    }

    public function update(VehicleRequest $request, Vehicle $vehicle): JsonResponse
    {
        $vehicle->update($request->validated());

        return response()->json(['data' => $vehicle]);
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        // Riwayat maintenance tidak ikut terhapus diam-diam: hapus catatannya dulu secara sadar.
        $count = $vehicle->maintenanceRecords()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Kendaraan {$vehicle->plate_number} masih punya {$count} catatan maintenance. Hapus catatannya terlebih dahulu.",
            ], 422);
        }

        $vehicle->delete();

        return response()->json(null, 204);
    }

    /**
     * GET /api/vehicles/{vehicle}/summary
     * Ringkasan biaya & aktivitas untuk kartu dashboard.
     */
    public function summary(Vehicle $vehicle): JsonResponse
    {
        $since = Carbon::today()->subMonthsNoOverflow(12);
        $records = $vehicle->maintenanceRecords();

        return response()->json(['data' => [
            'cost_12m' => (int) (clone $records)->where('service_date', '>=', $since)->sum('cost'),
            'records_12m' => (clone $records)->where('service_date', '>=', $since)->count(),
            'cost_total' => (int) (clone $records)->sum('cost'),
            'records_total' => (clone $records)->count(),
            'last_service_date' => (clone $records)->max('service_date')
                ? Carbon::parse((clone $records)->max('service_date'))->toDateString()
                : null,
        ]]);
    }

    /**
     * GET /api/vehicles/{vehicle}/parts-status
     * Status tiap part untuk kendaraan ini, dipakai untuk mewarnai model 3D.
     */
    public function partsStatus(Vehicle $vehicle): JsonResponse
    {
        // Catatan terakhir per part (yang mereset interval: replace).
        $last = MaintenanceRecord::where('vehicle_id', $vehicle->id)
            ->where('action', 'replace')
            ->orderBy('service_date')
            ->orderBy('id')
            ->get()
            ->keyBy('part_id'); // keyBy menimpa -> tersisa yang paling akhir

        $counts = MaintenanceRecord::where('vehicle_id', $vehicle->id)
            ->selectRaw('part_id, count(*) as total')
            ->groupBy('part_id')
            ->pluck('total', 'part_id');

        $today = Carbon::today();

        $data = Part::orderBy('category')->orderBy('name')->get()->map(function (Part $part) use ($vehicle, $last, $counts, $today) {
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

        return response()->json(['data' => $data, 'odometer' => $vehicle->odometer]);
    }
}
