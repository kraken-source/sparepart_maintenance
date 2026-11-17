<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MaintenanceRecordRequest;
use App\Models\MaintenanceRecord;
use App\Models\Vehicle;
use App\Services\DueReminderService;
use App\Support\PartLife;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Modul CRUD: catatan maintenance / penggantian sparepart.
 */
class MaintenanceRecordController extends Controller
{
    public function __construct(private DueReminderService $reminders) {}

    private const RELATIONS = [
        'part:id,name,category,mesh_name,interval_km,interval_days',
        'vehicle:id,plate_number,brand,model,odometer',
        'attachments',
    ];

    /** GET /api/maintenance-records?vehicle_id=&part_id=&q=&per_page= */
    public function index(Request $request): JsonResponse
    {
        $records = MaintenanceRecord::query()
            ->withSuperseded()
            ->with(self::RELATIONS)
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
            ->paginate(min($request->integer('per_page', 15), 100))
            ->through(fn (MaintenanceRecord $r) => $this->withNextService($r));

        return response()->json($records);
    }

    public function store(MaintenanceRecordRequest $request): JsonResponse
    {
        $record = DB::transaction(function () use ($request) {
            $record = MaintenanceRecord::create($this->payload($request));
            $this->syncOdometer($record);

            return $record;
        });
        $this->reminders->checkQuietly($record->vehicle_id);

        return response()->json(['data' => $this->present($record->id)], 201);
    }

    public function show(MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return response()->json(['data' => $this->present($maintenanceRecord->id)]);
    }

    public function update(MaintenanceRecordRequest $request, MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $previousVehicle = $maintenanceRecord->vehicle_id;
        DB::transaction(function () use ($request, $maintenanceRecord) {
            $maintenanceRecord->update($this->payload($request));
            $this->syncOdometer($maintenanceRecord);
        });
        foreach (array_unique([$previousVehicle, $maintenanceRecord->vehicle_id]) as $vehicleId) {
            $this->reminders->checkQuietly($vehicleId);
        }

        return response()->json(['data' => $this->present($maintenanceRecord->id)]);
    }

    public function destroy(MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $maintenanceRecord->delete();
        $this->reminders->checkQuietly($maintenanceRecord->vehicle_id);

        return response()->json(null, 204);
    }

    /** Usia pakai hanya berlaku untuk penggantian; perbaikan/pengecekan tidak menyimpannya. */
    private function payload(MaintenanceRecordRequest $request): array
    {
        $data = $request->validated();
        if ($data['action'] !== 'replace') {
            $data['life_km'] = null;
            $data['life_months'] = null;
        }

        return $data;
    }

    private function present(int $id): MaintenanceRecord
    {
        $record = MaintenanceRecord::withSuperseded()->with(self::RELATIONS)->findOrFail($id);

        return $this->withNextService($record);
    }

    /** Tambahkan jadwal ganti berikutnya (hanya untuk catatan penggantian). */
    private function withNextService(MaintenanceRecord $record): MaintenanceRecord
    {
        $record->setAttribute('next_service', $record->action === 'replace'
            ? PartLife::evaluate($record, $record->part, $record->vehicle->odometer)
            : null);

        return $record;
    }

    /** Odometer kendaraan ikut naik jika catatan baru punya angka km lebih tinggi. */
    private function syncOdometer(MaintenanceRecord $record): void
    {
        Vehicle::whereKey($record->vehicle_id)
            ->where('odometer', '<', $record->odometer)
            ->update(['odometer' => $record->odometer]);
    }
}
