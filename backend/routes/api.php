<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MaintenanceAttachmentController;
use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\PartController;
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
});
