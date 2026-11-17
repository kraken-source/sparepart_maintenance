<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MaintenanceRecordRequest;
use App\Models\MaintenanceRecord;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Modul CRUD: catatan maintenance / penggantian sparepart.
 */
class MaintenanceRecordController extends Controller
{
    /** GET /api/maintenance-records?vehicle_id=&part_id=&q=&per_page= */
    public function index(Request $request): JsonResponse
    {
        $records = MaintenanceRecord::query()
            ->with(['part:id,name,category,mesh_name', 'vehicle:id,plate_number,brand,model'])
            ->when($request->integer('vehicle_id'), fn ($q, $id) => $q->where('vehicle_id', $id))
            ->when($request->integer('part_id'), fn ($q, $id) => $q->where('part_id', $id))
            ->when($request->input('mesh_name'), fn ($q, $mesh) => $q->whereHas('part', fn ($p) => $p->where('mesh_name', $mesh)))
            ->when($request->input('q'), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('part_brand', 'like', "%{$term}%")
                        ->orWhere('workshop', 'like', "%{$term}%")
                        ->orWhere('notes', 'like', "%{$term}%")
                        ->orWhereHas('part', fn ($p) => $p->where('name', 'like', "%{$term}%"));
                });
            })
            ->orderByDesc('service_date')
            ->orderByDesc('id')
            ->paginate(min($request->integer('per_page', 15), 100));

        return response()->json($records);
    }

    public function store(MaintenanceRecordRequest $request): JsonResponse
    {
        $record = DB::transaction(function () use ($request) {
            $record = MaintenanceRecord::create($request->validated());
            $this->syncOdometer($record);

            return $record;
        });

        return response()->json(['data' => $record->load('part', 'vehicle')], 201);
    }

    public function show(MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return response()->json(['data' => $maintenanceRecord->load('part', 'vehicle')]);
    }

    public function update(MaintenanceRecordRequest $request, MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        DB::transaction(function () use ($request, $maintenanceRecord) {
            $maintenanceRecord->update($request->validated());
            $this->syncOdometer($maintenanceRecord);
        });

        return response()->json(['data' => $maintenanceRecord->load('part', 'vehicle')]);
    }

    public function destroy(MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $maintenanceRecord->delete();

        return response()->json(null, 204);
    }

    /** Odometer kendaraan ikut naik jika catatan baru punya angka km lebih tinggi. */
    private function syncOdometer(MaintenanceRecord $record): void
    {
        Vehicle::whereKey($record->vehicle_id)
            ->where('odometer', '<', $record->odometer)
            ->update(['odometer' => $record->odometer]);
    }
}
