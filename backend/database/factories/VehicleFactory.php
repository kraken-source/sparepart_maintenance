<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Vehicle>
 */
class VehicleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => \App\Models\User::factory(),
            'plate_number' => strtoupper('B '.fake()->unique()->numberBetween(1000, 9999).' '.fake()->lexify('???')),
            'brand' => 'Toyota',
            'model' => 'Kijang Innova',
            'year' => 2020,
            'odometer' => 50000,
            'model_3d_url' => null,
        ];
    }
}
