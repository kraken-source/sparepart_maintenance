<?php

namespace Database\Factories;

use App\Models\Part;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\MaintenanceRecord>
 */
class MaintenanceRecordFactory extends Factory
{
    public function definition(): array
    {
        return [
            'vehicle_id' => Vehicle::factory(),
            'part_id' => Part::factory(),
            'action' => 'replace',
            'service_date' => '2026-01-01',
            'odometer' => 40000,
            'life_km' => null,
            'life_months' => null,
            'part_brand' => 'Genuine',
            'cost' => 500000,
            'workshop' => 'Bengkel Uji',
            'notes' => null,
        ];
    }
}
