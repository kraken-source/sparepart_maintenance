<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Notifications\DatabaseNotification;

class Vehicle extends Model
{
    /** @use HasFactory<\Database\Factories\VehicleFactory> */
    use HasFactory;

    public const TYPE_CAR = 'car';

    public const TYPE_MOTORCYCLE = 'motorcycle';

    /** Jenis kendaraan yang didukung → label. */
    public const TYPES = [self::TYPE_CAR => 'Mobil', self::TYPE_MOTORCYCLE => 'Sepeda motor'];

    protected $fillable = [
        'user_id', 'type', 'plate_number', 'brand', 'model', 'year', 'odometer', 'model_3d_url',
        'fuel_group', 'default_fuel_type_id', 'tank_capacity',
    ];

    protected $attributes = ['type' => self::TYPE_CAR, 'fuel_group' => FuelType::GASOLINE];

    protected $casts = [
        'user_id' => 'integer', 'year' => 'integer', 'odometer' => 'integer',
        'default_fuel_type_id' => 'integer', 'tank_capacity' => 'float',
    ];

    protected static function booted(): void
    {
        // Notifikasi pengingat kendaraan ini ikut dihapus, agar lonceng tidak menampilkan
        // kendaraan yang sudah tidak ada (status pengingat & catatan BBM terhapus lewat cascade).
        static::deleting(function (self $vehicle) {
            DatabaseNotification::where('data->vehicle_id', $vehicle->id)->delete();
        });
    }

    public function fuelLogs(): HasMany
    {
        return $this->hasMany(FuelLog::class);
    }

    /** Jenis BBM yang otomatis terpilih saat mencatat pengisian. */
    public function defaultFuelType(): BelongsTo
    {
        return $this->belongsTo(FuelType::class, 'default_fuel_type_id');
    }

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
