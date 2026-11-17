<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DueReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Notifikasi di dalam aplikasi (lonceng) milik user yang sedang login.
 */
class NotificationController extends Controller
{
    /** GET /api/notifications → 30 terbaru + jumlah belum dibaca */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => $user->notifications()->latest()->limit(30)->get()
                ->map(fn ($n) => [
                    'id' => $n->id,
                    'data' => $n->data,
                    'read_at' => $n->read_at,
                    'created_at' => $n->created_at,
                ]),
            'unread_count' => $user->unreadNotifications()->count(),
        ]);
    }

    /** POST /api/notifications/{id}/read */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->findOrFail($id)->markAsRead();

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
