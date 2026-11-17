<?php

namespace App\Http\Requests;

use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class VehicleRequest extends FormRequest
{
    /**
     * Cek kepemilikan SEBELUM validasi: pesan validasi (mis. batas odometer) bisa membocorkan
     * data kendaraan orang lain. Kendaraan milik orang lain → 404 (VehiclePolicy).
     */
    public function authorize(): bool
    {
        $vehicle = $this->route('vehicle');
        if ($vehicle) {
            Gate::authorize('update', $vehicle);
        }

        return true;
    }

    /** Normalisasi plat: huruf besar, spasi tunggal ("b  1234 pls" -> "B 1234 PLS"). */
    protected function prepareForValidation(): void
    {
        if ($this->has('plate_number')) {
            $this->merge([
                'plate_number' => strtoupper(preg_replace('/\s+/', ' ', trim((string) $this->plate_number))),
            ]);
        }
    }

    public function rules(): array
    {
        $vehicle = $this->route('vehicle');

        // Odometer tidak boleh lebih kecil dari km pada catatan maintenance yang sudah ada.
        $minOdometer = $vehicle ? (int) $vehicle->maintenanceRecords()->max('odometer') : 0;

        return [
            // Jenis kendaraan (default mobil). Tidak bisa diubah bila sudah ada catatan,
            // karena part di catatan itu milik jenis yang lama.
            'type' => [
                'sometimes', Rule::in(array_keys(Vehicle::TYPES)),
                function ($attribute, $value, $fail) use ($vehicle) {
                    if ($vehicle && $vehicle->type !== $value && $vehicle->maintenanceRecords()->exists()) {
                        $fail('Jenis kendaraan tidak bisa diubah karena sudah ada catatan maintenance.');
                    }
                },
            ],
            'plate_number' => [
                'required', 'string', 'max:20',
                Rule::unique('vehicles', 'plate_number')->ignore($vehicle?->id),
            ],
            'brand' => ['required', 'string', 'max:50'],
            'model' => ['required', 'string', 'max:80'],
            'year' => ['nullable', 'integer', 'min:1950', 'max:'.(date('Y') + 1)],
            'odometer' => ['required', 'integer', "min:{$minOdometer}", 'max:9999999'],
            'model_3d_url' => ['nullable', 'string', 'max:255'],
            // Pemilik – hanya dipakai bila yang mengirim admin (diabaikan untuk user biasa).
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
        ];
    }

    public function messages(): array
    {
        return [
            'odometer.min' => 'Odometer tidak boleh lebih kecil dari catatan maintenance terakhir (:min km).',
        ];
    }

    public function attributes(): array
    {
        return [
            'plate_number' => 'plat nomor',
            'brand' => 'merek',
            'model' => 'model',
            'year' => 'tahun',
            'odometer' => 'odometer',
            'model_3d_url' => 'URL model 3D',
            'user_id' => 'pemilik',
            'type' => 'jenis kendaraan',
        ];
    }
}
