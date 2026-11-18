<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FuelTypeRequest;
use App\Models\FuelType;
use Illuminate\Http\JsonResponse;

/**
 * Master jenis bahan bakar. Semua user bisa melihat; tambah/ubah/hapus khusus admin.
 */
class FuelTypeController extends Controller
{
    /** GET /api/fuel-types (termasuk yang nonaktif; form hanya menawarkan yang aktif) */
    public function index(): JsonResponse
    {
        $types = FuelType::withCount('fuelLogs')
            ->orderBy('group')
            ->orderBy('rating')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $types]);
    }

    public function store(FuelTypeRequest $request): JsonResponse
    {
        return response()->json(['data' => FuelType::create($request->validated())], 201);
    }

    public function update(FuelTypeRequest $request, FuelType $fuelType): JsonResponse
    {
        $fuelType->update($request->validated());

        return response()->json(['data' => $fuelType->loadCount('fuelLogs')]);
    }

    public function destroy(FuelType $fuelType): JsonResponse
    {
        $count = $fuelType->fuelLogs()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Jenis BBM \"{$fuelType->name}\" tidak bisa dihapus karena dipakai di {$count} catatan pengisian. Nonaktifkan saja agar tidak muncul lagi di pilihan.",
            ], 422);
        }

        $fuelType->delete(); // kendaraan yang memakainya sebagai default → default dikosongkan (nullOnDelete)

        return response()->json(null, 204);
    }
}
