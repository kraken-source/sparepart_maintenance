<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PartAlertState extends Model
{
    protected $fillable = ['vehicle_id', 'part_id', 'status', 'notified_at'];

    protected $casts = ['notified_at' => 'datetime'];
}
