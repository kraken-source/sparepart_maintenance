<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaintenanceRecord extends Model
{
    protected $fillable = [
        'vehicle_id', 'part_id', 'action', 'service_date', 'odometer',
        'part_brand', 'cost', 'workshop', 'notes',
    ];

    protected $casts = [
        'service_date' => 'date:Y-m-d',
        'odometer' => 'integer',
        'cost' => 'integer',
    ];

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }
}
