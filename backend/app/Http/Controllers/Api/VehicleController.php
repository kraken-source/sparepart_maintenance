<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VehicleRequest;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use App\Services\PartStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * Kendaraan. User biasa hanya melihat & mengelola miliknya; admin semua (lihat VehiclePolicy).
 */
class VehicleController extends Controller
{
    /** GET /api/vehicles?owner_id= (filter pemilik khusus admin) */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $vehicles = Vehicle::visibleTo($user)
            ->with('owner:id,name,email')
            ->when($user->isAdmin() && $request->integer('owner_id'), fn ($q) => $q->where('user_id', $request->integer('owner_id')))
            ->withCount('maintenanceRecords')
            ->withMax('maintenanceRecords', 'odometer')
            ->orderBy('plate_number')
            ->get();

        return response()->json(['data' => $vehicles]);
    }

    public function store(VehicleRequest $request): JsonResponse
    {
        $data = $request->validated();
        // Pemilik: admin boleh memilih; selain itu selalu user yang membuat.
        $data['user_id'] = $request->user()->isAdmin() && ! empty($data['user_id']) ? $data['user_id'] : $request->user()->id;

        return response()->json(['data' => Vehicle::create($data)->load('owner:id,name,email')], 201);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        Gate::authorize('view', $vehicle);

        return response()->json(['data' => $vehicle->load('owner:id,name,email')->loadCount('maintenanceRecords')]);
    }

    public function update(VehicleRequest $request, Vehicle $vehicle, DueReminderService $reminders): JsonResponse
    {
        Gate::authorize('update', $vehicle);

        $data = $request->validated();
        if (! $request->user()->isAdmin() || empty($data['user_id'])) {
            unset($data['user_id']); // hanya admin yang bisa memindahkan pemilik
        }

        $vehicle->update($data);
        if ($vehicle->wasChanged(['odometer', 'user_id'])) {
            $reminders->checkQuietly($vehicle); // odometer naik bisa membuat part jatuh tempo
        }

        return response()->json(['data' => $vehicle->load('owner:id,name,email')]);
    }

    public function destroy(Vehicle $vehicle): JsonResponse
    {
        Gate::authorize('delete', $vehicle);

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
        Gate::authorize('view', $vehicle);

        $since = Carbon::today()->subMonthsNoOverflow(12)->toDateString();
        $records = $vehicle->maintenanceRecords();
        $last = (clone $records)->max('service_date');

        return response()->json(['data' => [
            'cost_12m' => (int) (clone $records)->whereDate('service_date', '>=', $since)->sum('cost'),
            'records_12m' => (clone $records)->whereDate('service_date', '>=', $since)->count(),
            'cost_total' => (int) (clone $records)->sum('cost'),
            'records_total' => (clone $records)->count(),
            'last_service_date' => $last ? Carbon::parse($last)->toDateString() : null,
        ]]);
    }

    /**
     * GET /api/vehicles/{vehicle}/parts-status
     * Status tiap part untuk kendaraan ini, dipakai untuk mewarnai model 3D.
     */
    public function partsStatus(Vehicle $vehicle, PartStatusService $status): JsonResponse
    {
        Gate::authorize('view', $vehicle);

        return response()->json(['data' => $status->forVehicle($vehicle), 'odometer' => $vehicle->odometer]);
    }
}
