<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Part extends Model
{
    /** @use HasFactory<\Database\Factories\PartFactory> */
    use HasFactory;

    /** vehicle_type: jenis kendaraan tempat part ini berlaku (lihat Vehicle::TYPES). */
    protected $fillable = ['vehicle_type', 'name', 'category', 'mesh_name', 'interval_km', 'interval_days'];

    protected $casts = ['interval_km' => 'integer', 'interval_days' => 'integer'];

    protected $attributes = ['vehicle_type' => Vehicle::TYPE_CAR];

    public function scopeForType(Builder $query, string $type): Builder
    {
        return $query->where('vehicle_type', $type);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }
}
