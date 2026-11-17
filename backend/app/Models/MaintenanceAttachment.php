<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Lampiran catatan maintenance (foto nota / bukti servis).
 * File disimpan privat di disk 'local' dan hanya bisa diambil lewat API yang terautentikasi.
 */
class MaintenanceAttachment extends Model
{
    public const DISK = 'local';

    protected $fillable = ['maintenance_record_id', 'path', 'original_name', 'mime', 'size'];

    protected $hidden = ['path'];

    protected $casts = ['size' => 'integer'];

    protected static function booted(): void
    {
        // Hapus file fisik bersama barisnya.
        static::deleted(fn (self $a) => Storage::disk(self::DISK)->delete($a->path));
    }

    public function record(): BelongsTo
    {
        return $this->belongsTo(MaintenanceRecord::class, 'maintenance_record_id');
    }
}
