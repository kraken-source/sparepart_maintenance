<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PartRequest;
use App\Models\Part;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Modul CRUD: master part / sparepart.
 */
class PartController extends Controller
{
    /** GET /api/parts?vehicle_type=car|motorcycle */
    public function index(Request $request): JsonResponse
    {
        $parts = Part::withCount('maintenanceRecords')
            ->when($request->input('vehicle_type'), fn ($q, $type) => $q->forType($type))
            ->orderBy('vehicle_type')
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $parts]);
    }

    public function store(PartRequest $request): JsonResponse
    {
        return response()->json(['data' => Part::create($request->validated())], 201);
    }

    public function show(Part $part): JsonResponse
    {
        return response()->json(['data' => $part->loadCount('maintenanceRecords')]);
    }

    public function update(PartRequest $request, Part $part): JsonResponse
    {
        $part->update($request->validated());

        return response()->json(['data' => $part]);
    }

    public function destroy(Part $part): JsonResponse
    {
        $count = $part->maintenanceRecords()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Part \"{$part->name}\" tidak bisa dihapus karena dipakai di {$count} catatan maintenance.",
            ], 422);
        }

        $part->delete();

        return response()->json(null, 204);
    }
}
