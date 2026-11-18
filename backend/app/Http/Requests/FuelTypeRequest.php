<?php

namespace App\Http\Requests;

use App\Models\FuelType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FuelTypeRequest extends FormRequest
{
    public function rules(): array
    {
        /** @var FuelType|null $type */
        $type = $this->route('fuel_type');

        return [
            'name' => ['required', 'string', 'max:60', Rule::unique('fuel_types', 'name')->ignore($type?->id)],
            // Kelompok tidak bisa diubah bila sudah dipakai: catatan lama kendaraan bensin jadi "diesel".
            'group' => [
                'required', Rule::in(array_keys(FuelType::GROUPS)),
                function ($attribute, $value, $fail) use ($type) {
                    if ($type && $type->group !== $value && $type->fuelLogs()->exists()) {
                        $fail('Kelompok tidak bisa diubah karena jenis BBM ini sudah dipakai di catatan pengisian.');
                    }
                },
            ],
            'rating' => ['nullable', 'integer', 'min:1', 'max:150'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return ['name' => 'nama', 'group' => 'kelompok', 'rating' => 'RON / angka setana', 'is_active' => 'status aktif'];
    }
}
