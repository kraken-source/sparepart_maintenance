<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FuelLogController;
use App\Http\Controllers\Api\FuelTypeController;
use App\Http\Controllers\Api\MaintenanceAttachmentController;
use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PartController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VehicleController;
use Illuminate\Support\Facades\Route;

// Maks. 5 percobaan login per menit per IP+email (cegah brute force).
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // ---------------- Semua pengguna (admin & user) ----------------
    Route::get('me', [AuthController::class, 'me']);
    Route::put('me/password', [AuthController::class, 'changePassword'])->middleware('throttle:6,1');
    Route::post('logout', [AuthController::class, 'logout']);

    // Kendaraan: setiap user mengelola miliknya sendiri, admin semua (dicek di VehiclePolicy)
    Route::apiResource('vehicles', VehicleController::class);
    Route::get('vehicles/{vehicle}/parts-status', [VehicleController::class, 'partsStatus']);
    Route::get('vehicles/{vehicle}/summary', [VehicleController::class, 'summary']);
    Route::get('parts', [PartController::class, 'index']);
    Route::get('parts/{part}', [PartController::class, 'show']);

    // Catatan maintenance: semua boleh lihat, tambah, ubah (hapus khusus admin, di bawah)
    Route::apiResource('maintenance-records', MaintenanceRecordController::class)->except('destroy');

    // Bahan bakar: pemilik kendaraan (dan admin) mencatat pengisian; konsumsi dihitung otomatis
    Route::get('fuel-types', [FuelTypeController::class, 'index']);
    Route::apiResource('fuel-logs', FuelLogController::class)->except('show');

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

    // ---------------- Khusus admin ----------------
    Route::middleware('can:admin')->group(function () {
        Route::apiResource('parts', PartController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('fuel-types', FuelTypeController::class)->only(['store', 'update', 'destroy']);
        Route::delete('maintenance-records/{maintenance_record}', [MaintenanceRecordController::class, 'destroy']);

        Route::apiResource('users', UserController::class)->except('show');
    });
});
