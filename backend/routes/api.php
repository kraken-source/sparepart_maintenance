<?php

use App\Http\Controllers\Api\MaintenanceRecordController;
use App\Http\Controllers\Api\PartController;
use App\Http\Controllers\Api\VehicleController;
use Illuminate\Support\Facades\Route;

// TODO: bungkus dengan middleware auth (mis. Sanctum) sebelum dipakai produksi.

Route::get('vehicles/{vehicle}/parts-status', [VehicleController::class, 'partsStatus']);

Route::apiResource('vehicles', VehicleController::class);
Route::apiResource('parts', PartController::class);
Route::apiResource('maintenance-records', MaintenanceRecordController::class);
