<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VehicleModelRequest;
use App\Models\VehicleModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Master model 3D. Semua user bisa melihat & memilih; tambah/ubah/hapus khusus admin.
 * Thumbnail diambil otomatis oleh frontend dari tampilan 3D lalu dikirim sebagai gambar.
 */
class VehicleModelController extends Controller
{
    /** GET /api/vehicle-models?vehicle_type= */
    public function index(Request $request): JsonResponse
    {
        $models = VehicleModel::withCount('vehicles')
            ->when($request->input('vehicle_type'), fn ($q, $type) => $q->where('vehicle_type', $type))
            ->orderByRaw("CASE source WHEN 'builtin' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $models]);
    }

    /** POST /api/vehicle-models (multipart: name, vehicle_type, file .glb, thumbnail?, notes?) */
    public function store(VehicleModelRequest $request): JsonResponse
    {
        $data = $request->safe()->except(['file', 'thumbnail']);
        $model = new VehicleModel($data + ['source' => VehicleModel::SOURCE_GLB]);
        $this->storeFile($model, $request->file('file'), $request->glb['mesh_names']);
        $this->storeThumbnail($model, $request->file('thumbnail'));
        $model->save();

        return response()->json(['data' => $model->loadCount('vehicles')], 201);
    }

    /** PUT /api/vehicle-models/{id} (kirim sebagai POST + _method=PUT bila ada file) */
    public function update(VehicleModelRequest $request, VehicleModel $vehicleModel): JsonResponse
    {
        $vehicleModel->fill($request->safe()->except(['file', 'thumbnail']));
        if ($request->hasFile('file')) {
            $old = $vehicleModel->file_path;
            $this->storeFile($vehicleModel, $request->file('file'), $request->glb['mesh_names']);
            Storage::disk(VehicleModel::DISK)->delete($old);
        }
        $this->storeThumbnail($vehicleModel, $request->file('thumbnail'));
        $vehicleModel->save();

        return response()->json(['data' => $vehicleModel->loadCount('vehicles')]);
    }

    /**
     * POST /api/vehicle-models/{id}/thumbnail – simpan thumbnail hasil tangkapan tampilan 3D.
     * Untuk model bawaan, daftar nama objek dikirim sekalian (dibaca dari scene oleh frontend),
     * karena model bawaan tidak punya file yang bisa dibaca server.
     */
    public function thumbnail(Request $request, VehicleModel $vehicleModel): JsonResponse
    {
        $data = $request->validate([
            'thumbnail' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'mesh_names' => ['nullable', 'array', 'max:2000'],
            'mesh_names.*' => ['string', 'max:120'],
        ], [], ['thumbnail' => 'thumbnail', 'mesh_names' => 'nama objek']);

        $this->storeThumbnail($vehicleModel, $request->file('thumbnail'));
        if ($vehicleModel->isBuiltin() && isset($data['mesh_names'])) {
            $names = array_values(array_unique(array_filter($data['mesh_names'])));
            sort($names);
            $vehicleModel->mesh_names = $names;
        }
        $vehicleModel->save();

        return response()->json(['data' => $vehicleModel->loadCount('vehicles')]);
    }

    public function destroy(VehicleModel $vehicleModel): JsonResponse
    {
        if ($vehicleModel->isBuiltin()) {
            return response()->json(['message' => 'Model bawaan tidak bisa dihapus. Nonaktifkan saja bila tidak dipakai.'], 422);
        }
        $count = $vehicleModel->vehicles()->count();
        if ($count > 0) {
            return response()->json([
                'message' => "Model \"{$vehicleModel->name}\" tidak bisa dihapus karena dipakai {$count} kendaraan. Ganti model kendaraannya dulu, atau nonaktifkan model ini.",
            ], 422);
        }

        $vehicleModel->delete(); // file & thumbnail ikut dihapus (VehicleModel::deleted)

        return response()->json(null, 204);
    }

    /** GET /api/vehicle-models/{id}/file – file .glb (tanpa login; dipakai loader 3D). */
    public function file(VehicleModel $vehicleModel): StreamedResponse
    {
        return $this->stream($vehicleModel->file_path, 'model/gltf-binary', Str::slug($vehicleModel->name).'.glb');
    }

    /** GET /api/vehicle-models/{id}/thumbnail – gambar thumbnail (tanpa login; dipakai <img>). */
    public function thumbnailFile(VehicleModel $vehicleModel): StreamedResponse
    {
        return $this->stream($vehicleModel->thumbnail_path, null, null);
    }

    private function stream(?string $path, ?string $mime, ?string $name): StreamedResponse
    {
        $disk = Storage::disk(VehicleModel::DISK);
        abort_unless($path && $disk->exists($path), 404, 'File tidak ditemukan.');

        // URL mengandung ?v=<hash path>, jadi aman di-cache lama: file baru = path baru = URL baru.
        return $disk->response($path, $name, array_filter([
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]));
    }

    private function storeFile(VehicleModel $model, UploadedFile $file, array $meshNames): void
    {
        $model->file_path = $file->storeAs('vehicle-models', Str::uuid().'.glb', VehicleModel::DISK);
        $model->file_size = $file->getSize();
        $model->mesh_names = $meshNames;
    }

    private function storeThumbnail(VehicleModel $model, ?UploadedFile $image): void
    {
        if (! $image) {
            return;
        }
        $old = $model->thumbnail_path;
        $model->thumbnail_path = $image->storeAs('vehicle-models/thumbnails', Str::uuid().'.'.($image->extension() ?: 'png'), VehicleModel::DISK);
        if ($old) {
            Storage::disk(VehicleModel::DISK)->delete($old);
        }
    }
}
