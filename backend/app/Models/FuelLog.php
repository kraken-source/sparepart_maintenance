<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/** Satu kali pengisian bahan bakar. */
class FuelLog extends Model
{
    /** @use HasFactory<\Database\Factories\FuelLogFactory> */
    use HasFactory;

    protected $fillable = [
        'vehicle_id', 'fuel_type_id', 'filled_on', 'odometer', 'liters', 'price_per_liter', 'total_cost',
        'is_full', 'missed_previous', 'station', 'notes',
    ];

    protected $attributes = ['is_full' => true, 'missed_previous' => false];

    protected $casts = [
        'vehicle_id' => 'integer',
        'fuel_type_id' => 'integer',
        'odometer' => 'integer',
        'liters' => 'float',
        'price_per_liter' => 'integer',
        'total_cost' => 'integer',
        'is_full' => 'boolean',
        'missed_previous' => 'boolean',
    ];

    /** Tanggal selalu disimpan "YYYY-MM-DD" agar perbandingan teks di SQLite benar. */
    protected function filledOn(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => $value === null ? null : Carbon::parse($value)->toDateString(),
        );
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function fuelType(): BelongsTo
    {
        return $this->belongsTo(FuelType::class);
    }
}
