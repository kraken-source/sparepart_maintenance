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
 * Parameter: from, to (YYYY-MM-DD; default 12 bulan terakhir), vehicle_id (opsional).
 */
class ReportController extends Controller
{
    public function __construct(private CostReportService $reports) {}

    /** GET /api/reports/costs */
    public function costs(Request $request): JsonResponse
    {
        [$from, $to, $vehicleId] = $this->filters($request);

        return response()->json(['data' => $this->reports->build($from, $to, $vehicleId, $request->user())]);
    }

    /** GET /api/reports/costs/export → file .xlsx */
    public function export(Request $request): BinaryFileResponse
    {
        [$from, $to, $vehicleId] = $this->filters($request);
        $export = new CostReportExport($this->reports->build($from, $to, $vehicleId, $request->user()));

        return response()->download($export->store(), $export->filename(), [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    private function filters(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            // Hanya kendaraan yang boleh dilihat user (milik sendiri; admin: semua).
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where(
                fn ($q) => $request->user()->isAdmin() ? $q : $q->where('user_id', $request->user()->id),
            )],
        ], [], ['from' => 'tanggal awal', 'to' => 'tanggal akhir', 'vehicle_id' => 'kendaraan']);

        $to = isset($data['to']) ? Carbon::parse($data['to']) : Carbon::today();
        $from = isset($data['from']) ? Carbon::parse($data['from']) : $to->copy()->subMonthsNoOverflow(11)->startOfMonth();

        if ($from->diffInMonths($to) > 60) {
            abort(422, 'Rentang laporan maksimal 5 tahun.');
        }

        return [$from->startOfDay(), $to->startOfDay(), $data['vehicle_id'] ?? null];
    }
}
