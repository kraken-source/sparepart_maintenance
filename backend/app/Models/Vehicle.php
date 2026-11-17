<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    protected $fillable = ['plate_number', 'brand', 'model', 'year', 'odometer', 'model_3d_url'];

    protected $casts = ['year' => 'integer', 'odometer' => 'integer'];

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }
}
