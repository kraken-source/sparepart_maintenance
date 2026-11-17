<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MaintenanceAttachment;
use App\Models\MaintenanceRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lampiran (foto nota / bukti servis) untuk catatan maintenance.
 */
class MaintenanceAttachmentController extends Controller
{
    /** POST /api/maintenance-records/{record}/attachments  (multipart: files[]) */
    public function store(Request $request, MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        Gate::authorize('update', $maintenanceRecord->vehicle);

        $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:8192'],
        ], [
            'files.*.mimes' => 'File harus berupa gambar (JPG, PNG, WEBP) atau PDF.',
            'files.*.max' => 'Ukuran file maksimal 8 MB.',
        ], ['files' => 'file', 'files.*' => 'file']);

        $existing = $maintenanceRecord->attachments()->count();
        $incoming = count($request->file('files'));
        if ($existing + $incoming > MaintenanceRecord::MAX_ATTACHMENTS) {
            throw ValidationException::withMessages([
                'files' => 'Maksimal '.MaintenanceRecord::MAX_ATTACHMENTS." lampiran per catatan (sudah ada {$existing}).",
            ]);
        }

        $dir = "attachments/{$maintenanceRecord->id}";
        $stored = [];

        try {
            $created = DB::transaction(function () use ($request, $maintenanceRecord, $dir, &$stored) {
                return collect($request->file('files'))->map(function ($file) use ($maintenanceRecord, $dir, &$stored) {
                    // Nama acak: nama asli dari user tidak dipakai di path.
                    $path = $file->store($dir, MaintenanceAttachment::DISK);
                    $stored[] = $path;

                    return $maintenanceRecord->attachments()->create([
                        'path' => $path,
                        'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                        'mime' => $file->getMimeType(),
                        'size' => $file->getSize(),
                    ]);
                });
            });
        } catch (\Throwable $e) {
            Storage::disk(MaintenanceAttachment::DISK)->delete($stored); // jangan tinggalkan file yatim
            throw $e;
        }

        return response()->json(['data' => $created->values()], 201);
    }

    /** GET /api/attachments/{attachment} – isi file (inline). */
    public function show(MaintenanceAttachment $attachment): StreamedResponse
    {
        Gate::authorize('view', $attachment->record->vehicle);

        $disk = Storage::disk(MaintenanceAttachment::DISK);
        abort_unless($disk->exists($attachment->path), 404, 'File lampiran tidak ditemukan.');

        return $disk->response($attachment->path, $attachment->original_name, [
            'Content-Type' => $attachment->mime,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(MaintenanceAttachment $attachment): JsonResponse
    {
        Gate::authorize('update', $attachment->record->vehicle);

        $attachment->delete();

        return response()->json(null, 204);
    }
}
