<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FuelLogRequest;
use App\Models\FuelLog;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use App\Services\FuelEconomyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Pencatatan pengisian bahan bakar per kendaraan.
 * Pemilik kendaraan (dan admin) boleh menambah, mengubah, dan menghapus.
 */
class FuelLogController extends Controller
{
    public function __construct(private FuelEconomyService $economy, private DueReminderService $reminders) {}

    /** GET /api/fuel-logs?vehicle_id= → riwayat + ringkasan konsumsi kendaraan tsb. */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['vehicle_id' => ['required', 'integer']], [], ['vehicle_id' => 'kendaraan']);
        $vehicle = Vehicle::findOrFail($request->integer('vehicle_id'));
        Gate::authorize('view', $vehicle);

        return response()->json(['data' => [
            'vehicle' => $vehicle->only(['id', 'plate_number', 'fuel_group', 'default_fuel_type_id', 'tank_capacity', 'odometer']),
        ] + $this->economy->forVehicle($vehicle)]);
    }

    public function store(FuelLogRequest $request): JsonResponse
    {
        $log = DB::transaction(function () use ($request) {
            $log = FuelLog::create($request->payload());
            $this->syncOdometer($log);

            return $log;
        });
        $this->reminders->checkQuietly($log->vehicle_id); // odometer naik bisa membuat part jatuh tempo

        return response()->json(['data' => $log->load('fuelType:id,name,group')], 201);
    }

    public function update(FuelLogRequest $request, FuelLog $fuelLog): JsonResponse
    {
        DB::transaction(function () use ($request, $fuelLog) {
            $fuelLog->update($request->payload());
            $this->syncOdometer($fuelLog);
        });
        $this->reminders->checkQuietly($fuelLog->vehicle_id);

        return response()->json(['data' => $fuelLog->load('fuelType:id,name,group')]);
    }

    public function destroy(FuelLog $fuelLog): JsonResponse
    {
        Gate::authorize('update', $fuelLog->vehicle);
        $fuelLog->delete();

        return response()->json(null, 204);
    }

    /** Odometer kendaraan ikut naik jika pengisian ini punya angka km lebih tinggi. */
    private function syncOdometer(FuelLog $log): void
    {
        Vehicle::whereKey($log->vehicle_id)
            ->where('odometer', '<', $log->odometer)
            ->update(['odometer' => $log->odometer]);
    }
}
