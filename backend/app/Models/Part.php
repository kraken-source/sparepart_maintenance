<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Part extends Model
{
    protected $fillable = ['name', 'category', 'mesh_name', 'interval_km', 'interval_days'];

    protected $casts = ['interval_km' => 'integer', 'interval_days' => 'integer'];

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(MaintenanceRecord::class);
    }
}
