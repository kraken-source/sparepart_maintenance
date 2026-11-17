<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MaintenanceRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // TODO: ganti dengan policy setelah autentikasi ditambahkan
    }

    public function rules(): array
    {
        return [
            'vehicle_id' => ['required', 'integer', 'exists:vehicles,id'],
            'part_id' => ['required', 'integer', 'exists:parts,id'],
            'action' => ['required', 'in:replace,repair,inspect'],
            'service_date' => ['required', 'date', 'before_or_equal:today'],
            'odometer' => ['required', 'integer', 'min:0', 'max:9999999'],
            // Usia pakai part yang dipasang (hanya untuk tindakan "replace")
            'life_km' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'life_months' => ['nullable', 'integer', 'min:1', 'max:120'],
            'part_brand' => ['nullable', 'string', 'max:80'],
            'cost' => ['nullable', 'integer', 'min:0'],
            'workshop' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'vehicle_id' => 'kendaraan',
            'part_id' => 'part',
            'action' => 'tindakan',
            'service_date' => 'tanggal servis',
            'odometer' => 'odometer',
            'life_km' => 'usia pakai (km)',
            'life_months' => 'usia pakai (bulan)',
            'part_brand' => 'merek part',
            'cost' => 'biaya',
            'workshop' => 'bengkel',
            'notes' => 'catatan',
        ];
    }
}
