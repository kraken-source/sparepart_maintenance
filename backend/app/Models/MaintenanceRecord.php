<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MaintenanceRecord extends Model
{
    /** Batas jumlah lampiran per catatan. */
    public const MAX_ATTACHMENTS = 10;

    protected $fillable = [
        'vehicle_id', 'part_id', 'action', 'service_date', 'odometer',
        'life_km', 'life_months',
        'part_brand', 'cost', 'workshop', 'notes',
    ];

    protected $casts = [
        'service_date' => 'date:Y-m-d',
        'odometer' => 'integer',
        'life_km' => 'integer',
        'life_months' => 'integer',
        'cost' => 'integer',
        'superseded' => 'boolean',
    ];

    /**
     * Tambah kolom `superseded`: true bila part yang sama pada kendaraan yang sama
     * sudah diganti lagi setelah catatan ini (jadwal di catatan ini tidak berlaku lagi).
     */
    public function scopeWithSuperseded(Builder $query): Builder
    {
        return $query->select('maintenance_records.*')->selectRaw(<<<'SQL'
            exists (
                select 1 from maintenance_records later
                where later.vehicle_id = maintenance_records.vehicle_id
                  and later.part_id = maintenance_records.part_id
                  and later.action = 'replace'
                  and (later.service_date > maintenance_records.service_date
                       or (later.service_date = maintenance_records.service_date and later.id > maintenance_records.id))
            ) as superseded
            SQL);
    }

    protected static function booted(): void
    {
        // Cascade di database tidak memicu event model, jadi hapus lampiran lewat model
        // agar file fisiknya ikut terhapus.
        static::deleting(function (self $record) {
            $record->attachments()->get()->each->delete();
        });
    }

    /**
     * Simpan tanggal servis selalu sebagai "YYYY-MM-DD" (tanpa jam). Format campuran
     * ("2026-10-18" vs "2026-10-18 00:00:00") membuat perbandingan teks di SQLite keliru,
     * mis. catatan di hari terakhir rentang laporan tidak terhitung.
     */
    protected function serviceDate(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => $value === null ? null : Carbon::parse($value)->toDateString(),
        );
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(MaintenanceAttachment::class)->orderBy('id');
    }
}
