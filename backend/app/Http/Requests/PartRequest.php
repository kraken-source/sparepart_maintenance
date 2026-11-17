<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // TODO: ganti dengan policy setelah autentikasi ditambahkan
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('mesh_name')) {
            $this->merge(['mesh_name' => strtolower(trim((string) $this->mesh_name))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'category' => ['required', 'string', 'max:50'],
            // Harus sama persis dengan nama mesh di model 3D.
            'mesh_name' => [
                'required', 'string', 'max:80', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('parts', 'mesh_name')->ignore($this->route('part')?->id),
            ],
            'interval_km' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'interval_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ];
    }

    public function messages(): array
    {
        return [
            'mesh_name.regex' => 'Nama mesh hanya boleh huruf kecil, angka dan underscore (mis. tire_front_left).',
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nama part',
            'category' => 'kategori',
            'mesh_name' => 'nama mesh 3D',
            'interval_km' => 'interval km',
            'interval_days' => 'interval hari',
        ];
    }
}
