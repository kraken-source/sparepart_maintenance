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
            'part_brand' => 'merek part',
            'cost' => 'biaya',
            'workshop' => 'bengkel',
            'notes' => 'catatan',
        ];
    }
}
