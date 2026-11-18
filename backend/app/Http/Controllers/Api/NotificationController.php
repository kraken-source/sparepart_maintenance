<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use App\Services\DueReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Notifikasi di dalam aplikasi (lonceng) milik user yang sedang login.
 */
class NotificationController extends Controller
{
    /**
     * Notifikasi user yang kendaraannya masih ada DAN masih boleh dilihat user tsb.
     * Kendaraan yang sudah dihapus atau dipindah ke pemilik lain tidak lagi muncul di lonceng.
     */
    private function visible(Request $request): MorphMany
    {
        $user = $request->user();

        return $user->notifications()->whereIn('data->vehicle_id', Vehicle::visibleTo($user)->select('id'));
    }

    /** GET /api/notifications → 30 terbaru + jumlah belum dibaca */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->visible($request)->latest()->limit(30)->get()
                ->map(fn ($n) => [
                    'id' => $n->id,
                    'data' => $n->data,
                    'read_at' => $n->read_at,
                    'created_at' => $n->created_at,
                ]),
            'unread_count' => $this->visible($request)->whereNull('read_at')->count(),
        ]);
    }

    /** POST /api/notifications/{id}/read */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $this->visible($request)->findOrFail($id)->markAsRead();

        return response()->json(null, 204);
    }

    /** POST /api/notifications/read-all */
    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(null, 204);
    }

    /** POST /api/notifications/check – jalankan pemeriksaan jatuh tempo sekarang. */
    public function check(DueReminderService $reminders): JsonResponse
    {
        return response()->json(['vehicles_notified' => $reminders->check()]);
    }
}
