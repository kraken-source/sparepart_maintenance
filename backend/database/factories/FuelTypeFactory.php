<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\FuelType>
 */
class FuelTypeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => 'BBM '.fake()->unique()->bothify('??-###'),
            'group' => 'gasoline',
            'rating' => 92,
            'is_active' => true,
        ];
    }

    public function diesel(): static
    {
        return $this->state(['group' => 'diesel', 'rating' => 51]);
    }
}
