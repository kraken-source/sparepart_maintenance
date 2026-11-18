<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\VehicleModel>
 */
class VehicleModelFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'Model '.fake()->unique()->bothify('??-###'),
            'vehicle_type' => 'car',
            'source' => 'glb',
            'file_path' => null,
            'file_size' => null,
            'mesh_names' => ['engine_oil', 'battery'],
            'is_active' => true,
        ];
    }
}
