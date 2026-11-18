<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Master jenis bahan bakar (Pertalite, Pertamax, Dexlite, …). */
class FuelType extends Model
{
    /** @use HasFactory<\Database\Factories\FuelTypeFactory> */
    use HasFactory;

    public const GASOLINE = 'gasoline';

    public const DIESEL = 'diesel';

    /** Kelompok BBM → label. Kendaraan bensin hanya bisa diisi jenis bensin, dst. */
    public const GROUPS = [self::GASOLINE => 'Bensin', self::DIESEL => 'Diesel'];

    protected $fillable = ['name', 'group', 'rating', 'is_active'];

    protected $attributes = ['is_active' => true];

    protected $casts = ['rating' => 'integer', 'is_active' => 'boolean'];

    public function fuelLogs(): HasMany
    {
        return $this->hasMany(FuelLog::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
