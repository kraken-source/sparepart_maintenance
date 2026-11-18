<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Master model 3D kendaraan.
 * - source "builtin": model prosedural yang dibuat di kode frontend (builtin_key = palisade/innova/beat)
 * - source "glb"    : file .glb yang di-upload admin
 *
 * File .glb & thumbnail disimpan di disk privat 'local' dan disajikan lewat route
 * vehicle-models/{id}/file & /thumbnail (tanpa login, karena viewer 3D dan <img> tidak
 * bisa mengirim token; isinya bukan data rahasia).
 */
class VehicleModel extends Model
{
    /** @use HasFactory<\Database\Factories\VehicleModelFactory> */
    use HasFactory;

    public const SOURCE_BUILTIN = 'builtin';

    public const SOURCE_GLB = 'glb';

    public const DISK = 'local';

    /** Model bawaan yang ada di kode frontend (components/models). */
    public const BUILTINS = [
        'palisade' => ['name' => 'Hyundai Palisade 2026', 'vehicle_type' => 'car'],
        'innova' => ['name' => 'Toyota Kijang Innova 2012', 'vehicle_type' => 'car'],
        'beat' => ['name' => 'Honda BeAT eSP 2021', 'vehicle_type' => 'motorcycle'],
    ];

    /** Model default per jenis kendaraan (dipakai bila kendaraan belum memilih model). */
    public const DEFAULT_BUILTIN = ['car' => 'palisade', 'motorcycle' => 'beat'];

    protected $fillable = [
        'name', 'vehicle_type', 'source', 'builtin_key', 'file_path', 'file_size',
        'thumbnail_path', 'mesh_names', 'is_active', 'notes',
    ];

    protected $attributes = ['is_active' => true, 'source' => self::SOURCE_GLB];

    protected $casts = ['mesh_names' => 'array', 'is_active' => 'boolean', 'file_size' => 'integer'];

    protected $hidden = ['file_path', 'thumbnail_path'];

    protected $appends = ['file_url', 'thumbnail_url'];

    protected static function booted(): void
    {
        static::deleted(function (self $model) {
            Storage::disk(self::DISK)->delete(array_filter([$model->file_path, $model->thumbnail_path]));
        });
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function isBuiltin(): bool
    {
        return $this->source === self::SOURCE_BUILTIN;
    }

    /** Model bawaan default untuk jenis kendaraan. */
    public static function defaultFor(string $vehicleType): ?self
    {
        return self::where('builtin_key', self::DEFAULT_BUILTIN[$vehicleType] ?? 'palisade')->first();
    }

    // ?v= berubah setiap kali file diganti, agar browser tidak memakai cache lama.
    public function getFileUrlAttribute(): ?string
    {
        return $this->file_path ? "/api/vehicle-models/{$this->id}/file?v=".md5($this->file_path) : null;
    }

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->thumbnail_path ? "/api/vehicle-models/{$this->id}/thumbnail?v=".md5($this->thumbnail_path) : null;
    }
}
