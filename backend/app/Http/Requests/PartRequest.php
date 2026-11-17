<?php

namespace App\Http\Requests;

use App\Models\Vehicle;
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
        $part = $this->route('part');

        return [
            'vehicle_type' => [
                'required', Rule::in(array_keys(Vehicle::TYPES)),
                // Part yang sudah dipakai catatan tidak boleh pindah jenis kendaraan.
                function ($attribute, $value, $fail) use ($part) {
                    if ($part && $part->vehicle_type !== $value && $part->maintenanceRecords()->exists()) {
                        $fail('Jenis kendaraan tidak bisa diubah karena part ini sudah dipakai di catatan maintenance.');
                    }
                },
            ],
            'name' => ['required', 'string', 'max:100'],
            'category' => ['required', 'string', 'max:50'],
            // Harus sama persis dengan nama mesh di model 3D; unik per jenis kendaraan.
            'mesh_name' => [
                'required', 'string', 'max:80', 'regex:/^[a-z0-9_]+$/',
                Rule::unique('parts', 'mesh_name')
                    ->where('vehicle_type', (string) $this->input('vehicle_type'))
                    ->ignore($part?->id),
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
            'vehicle_type' => 'jenis kendaraan',
            'name' => 'nama part',
            'category' => 'kategori',
            'mesh_name' => 'nama mesh 3D',
            'interval_km' => 'interval km',
            'interval_days' => 'interval hari',
        ];
    }
}
