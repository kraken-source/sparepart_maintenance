<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VehicleRequest;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use App\Services\PartStatusService;
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

    public function update(VehicleRequest $request, Vehicle $vehicle, DueReminderService $reminders): JsonResponse
    {
        $vehicle->update($request->validated());
        if ($vehicle->wasChanged('odometer')) {
            $reminders->checkQuietly($vehicle); // odometer naik bisa membuat part jatuh tempo
        }

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
    public function partsStatus(Vehicle $vehicle, PartStatusService $status): JsonResponse
    {
        return response()->json(['data' => $status->forVehicle($vehicle), 'odometer' => $vehicle->odometer]);
    }
}
