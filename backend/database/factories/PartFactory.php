<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Part>
 */
class PartFactory extends Factory
{
    public function definition(): array
    {
        return [
            'vehicle_type' => 'car',
            'name' => 'Part '.fake()->unique()->word(),
            'category' => 'Mesin',
            'mesh_name' => 'part_'.fake()->unique()->numberBetween(1, 1_000_000),
            'interval_km' => 10000,
            'interval_days' => 180,
        ];
    }
}
