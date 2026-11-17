<?php

namespace App\Http\Requests;

use App\Models\Part;
use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class MaintenanceRecordRequest extends FormRequest
{
    /** Edit catatan: kendaraannya harus milik user (atau user admin) – dicek sebelum validasi. */
    public function authorize(): bool
    {
        $record = $this->route('maintenance_record');
        if ($record) {
            Gate::authorize('update', $record->vehicle);
        }

        return true;
    }

    public function rules(): array
    {
        $user = $this->user();

        return [
            // Hanya kendaraan yang boleh dilihat user (milik sendiri; admin: semua).
            'vehicle_id' => ['required', 'integer', Rule::exists('vehicles', 'id')->where(
                fn ($q) => $user->isAdmin() ? $q : $q->where('user_id', $user->id),
            )],
            // Part harus untuk jenis kendaraan yang sama (part motor tidak bisa dipakai di mobil).
            'part_id' => ['required', 'integer', 'exists:parts,id', function ($attribute, $value, $fail) {
                $vehicleType = Vehicle::whereKey($this->input('vehicle_id'))->value('type');
                $partType = Part::whereKey($value)->value('vehicle_type');
                if ($vehicleType && $partType && $vehicleType !== $partType) {
                    $fail('Part ini untuk '.strtolower(Vehicle::TYPES[$partType] ?? $partType).', tidak sesuai dengan jenis kendaraan yang dipilih.');
                }
            }],
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

    public function messages(): array
    {
        return [
            'service_date.before_or_equal' => 'Tanggal servis tidak boleh melebihi hari ini.',
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
