<?php

namespace App\Http\Controllers\Api;

use App\Exports\CostReportExport;
use App\Http\Controllers\Controller;
use App\Services\CostReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Laporan biaya maintenance.
 * Parameter: from, to (YYYY-MM-DD; default 12 bulan terakhir), vehicle_id (opsional),
 * owner_id (opsional, khusus admin), include_fuel (0/1, default 1: gabungkan biaya BBM).
 */
class ReportController extends Controller
{
    public function __construct(private CostReportService $reports) {}

    /** GET /api/reports/costs */
    public function costs(Request $request): JsonResponse
    {
        [$from, $to, $vehicleId, $ownerId, $includeFuel] = $this->filters($request);

        return response()->json(['data' => $this->reports->build($from, $to, $vehicleId, $request->user(), $ownerId, $includeFuel)]);
    }

    /** GET /api/reports/costs/export → file .xlsx */
    public function export(Request $request): BinaryFileResponse
    {
        [$from, $to, $vehicleId, $ownerId, $includeFuel] = $this->filters($request);
        $export = new CostReportExport($this->reports->build($from, $to, $vehicleId, $request->user(), $ownerId, $includeFuel));

        return response()->download($export->store(), $export->filename(), [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    private function filters(Request $request): array
    {
        $user = $request->user();
        $ownerId = $user->isAdmin() ? $request->integer('owner_id') ?: null : null;

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'include_fuel' => ['nullable', 'boolean'], // gabungkan biaya BBM (default ya)
            // Filter pemilik hanya untuk admin; user biasa otomatis hanya melihat miliknya sendiri.
            'owner_id' => $user->isAdmin() ? ['nullable', 'integer', Rule::exists('users', 'id')] : ['prohibited'],
            // Hanya kendaraan yang boleh dilihat user (milik sendiri; admin: semua),
            // dan bila pemilik dipilih, kendaraan harus milik pemilik tersebut.
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where(
                fn ($q) => $user->isAdmin()
                    ? $q->when($ownerId, fn ($q) => $q->where('user_id', $ownerId))
                    : $q->where('user_id', $user->id),
            )],
        ], $ownerId ? ['vehicle_id.exists' => 'Kendaraan yang dipilih bukan milik pemilik tersebut.'] : [], ['from' => 'tanggal awal', 'to' => 'tanggal akhir', 'vehicle_id' => 'kendaraan', 'owner_id' => 'pemilik', 'include_fuel' => 'sertakan BBM']);

        $to = isset($data['to']) ? Carbon::parse($data['to']) : Carbon::today();
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $to->copy()->subMonthsNoOverflow(11)->startOfMonth();

        if ($from->diffInMonths($to) > 60) {
            abort(422, 'Rentang laporan maksimal 5 tahun.');
        }

        return [$from->startOfDay(), $to->startOfDay(), $data['vehicle_id'] ?? null, $data['owner_id'] ?? null, (bool) ($data['include_fuel'] ?? true)];
    }
}
