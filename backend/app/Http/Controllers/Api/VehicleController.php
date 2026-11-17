<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VehicleRequest;
use App\Models\MaintenanceRecord;
use App\Models\Part;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class VehicleController extends Controller
{
    /** Ambang "segera": sisa jarak/waktu <= 15% dari interval. */
    private const DUE_SOON_RATIO = 0.15;

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
            $status = 'unknown';
            $remainingKm = null;
            $remainingDays = null;
            $nextDate = null;

            if ($record) {
                $ratios = [];

                if ($part->interval_km) {
                    $remainingKm = $record->odometer + $part->interval_km - $vehicle->odometer;
                    $ratios[] = $remainingKm / $part->interval_km;
                }
                if ($part->interval_days) {
                    $next = $record->service_date->copy()->addDays($part->interval_days);
                    $nextDate = $next->toDateString();
                    $remainingDays = (int) $today->diffInDays($next, false);
                    $ratios[] = $remainingDays / $part->interval_days;
                }

                $worst = $ratios ? min($ratios) : 1;
                $status = $worst <= 0 ? 'overdue' : ($worst <= self::DUE_SOON_RATIO ? 'due_soon' : 'ok');
            }

            return [
                'id' => $part->id,
                'name' => $part->name,
                'category' => $part->category,
                'mesh_name' => $part->mesh_name,
                'interval_km' => $part->interval_km,
                'interval_days' => $part->interval_days,
                'status' => $status,
                'last_service_date' => $record?->service_date?->toDateString(),
                'last_odometer' => $record?->odometer,
                'remaining_km' => $remainingKm,
                'remaining_days' => $remainingDays,
                'next_service_date' => $nextDate,
                'record_count' => (int) ($counts[$part->id] ?? 0),
            ];
        });

        return response()->json(['data' => $data, 'odometer' => $vehicle->odometer]);
    }
}
