<?php

namespace Database\Factories;

use App\Models\FuelType;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\FuelLog>
 */
class FuelLogFactory extends Factory
{
    public function definition(): array
    {
        return [
            'vehicle_id' => Vehicle::factory(),
            'fuel_type_id' => FuelType::factory(),
            'filled_on' => '2026-11-01',
            'odometer' => 50000,
            'liters' => 40,
            'price_per_liter' => 12500,
            'total_cost' => 500000,
            'is_full' => true,
            'missed_previous' => false,
        ];
    }
}
