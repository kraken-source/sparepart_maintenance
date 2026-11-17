<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    /** @use HasFactory<\Database\Factories\VehicleFactory> */
    use HasFactory;

    public const TYPE_CAR = 'car';

    public const TYPE_MOTORCYCLE = 'motorcycle';

    /** Jenis kendaraan yang didukung → label. */
    public const TYPES = [self::TYPE_CAR => 'Mobil', self::TYPE_MOTORCYCLE => 'Sepeda motor'];

    protected $fillable = ['user_id', 'type', 'plate_number', 'brand', 'model', 'year', 'odometer', 'model_3d_url'];

    protected $attributes = ['type' => self::TYPE_CAR];

    protected $casts = ['user_id' => 'integer', 'year' => 'integer', 'odometer' => 'integer'];

    /** Pemilik kendaraan. */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }

    /**
     * Kendaraan yang boleh dilihat user: admin → semua, user biasa → miliknya saja.
     * Semua query data kendaraan (catatan, lampiran, laporan, status) harus melalui scope ini.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->isAdmin() ? $query : $query->where('user_id', $user->id);
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->isAdmin() || $this->user_id === $user->id;
    }
}
