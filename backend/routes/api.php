<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MaintenanceAttachmentController;
use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PartController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\VehicleController;
use Illuminate\Support\Facades\Route;

// Maks. 5 percobaan login per menit per IP+email (cegah brute force).
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);

    Route::get('vehicles/{vehicle}/parts-status', [VehicleController::class, 'partsStatus']);
    Route::get('vehicles/{vehicle}/summary', [VehicleController::class, 'summary']);

    Route::apiResource('vehicles', VehicleController::class);
    Route::apiResource('parts', PartController::class);
    Route::apiResource('maintenance-records', MaintenanceRecordController::class);

    // Lampiran foto nota / bukti servis
    Route::post('maintenance-records/{maintenance_record}/attachments', [MaintenanceAttachmentController::class, 'store']);
    Route::get('attachments/{attachment}', [MaintenanceAttachmentController::class, 'show']);
    Route::delete('attachments/{attachment}', [MaintenanceAttachmentController::class, 'destroy']);

    // Laporan biaya
    Route::get('reports/costs', [ReportController::class, 'costs']);
    Route::get('reports/costs/export', [ReportController::class, 'export']);

    // Notifikasi di aplikasi (pengingat jatuh tempo)
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('notifications/check', [NotificationController::class, 'check'])->middleware('throttle:6,1');
    Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);
});
