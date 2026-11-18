<?php

namespace App\Http\Requests;

use App\Models\FuelType;
use App\Models\Vehicle;
use App\Models\VehicleModel;
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

        // Odometer tidak boleh lebih kecil dari km pada catatan maintenance / pengisian BBM yang sudah ada.
        $minOdometer = $vehicle
            ? max((int) $vehicle->maintenanceRecords()->max('odometer'), (int) $vehicle->fuelLogs()->max('odometer'))
            : 0;
        $fuelGroup = $this->input('fuel_group', $vehicle?->fuel_group ?? FuelType::GASOLINE);

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
            // Model 3D dari master: harus sesuai jenis kendaraan dan masih aktif
            // (model nonaktif tetap boleh bila memang sudah dipakai kendaraan ini).
            'vehicle_model_id' => [
                'nullable', 'integer', 'exists:vehicle_models,id',
                function ($attribute, $value, $fail) use ($vehicle) {
                    $model = VehicleModel::find($value);
                    $type = $this->input('type', $vehicle?->type ?? Vehicle::TYPE_CAR);
                    if (! $model) {
                        return;
                    }
                    if ($model->vehicle_type !== $type) {
                        $fail("Model {$model->name} untuk ".strtolower(Vehicle::TYPES[$model->vehicle_type] ?? $model->vehicle_type)
                            .', tidak sesuai dengan jenis kendaraan.');
                    } elseif (! $model->is_active && $vehicle?->vehicle_model_id !== $model->id) {
                        $fail("Model {$model->name} sudah tidak aktif.");
                    }
                },
            ],
            // Bahan bakar: kelompok tidak bisa diubah bila sudah ada catatan pengisian.
            'fuel_group' => [
                'sometimes', Rule::in(array_keys(FuelType::GROUPS)),
                function ($attribute, $value, $fail) use ($vehicle) {
                    if ($vehicle && $vehicle->fuel_group !== $value && $vehicle->fuelLogs()->exists()) {
                        $fail('Jenis bahan bakar tidak bisa diubah karena sudah ada catatan pengisian.');
                    }
                },
            ],
            'default_fuel_type_id' => [
                'nullable', 'integer', 'exists:fuel_types,id',
                function ($attribute, $value, $fail) use ($fuelGroup) {
                    $type = FuelType::find($value);
                    if ($type && $type->group !== $fuelGroup) {
                        $fail("{$type->name} bukan BBM ".strtolower(FuelType::GROUPS[$fuelGroup] ?? $fuelGroup).'.');
                    }
                },
            ],
            'tank_capacity' => ['nullable', 'numeric', 'min:1', 'max:500'],
            // Pemilik – hanya dipakai bila yang mengirim admin (diabaikan untuk user biasa).
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
        ];
    }

    public function messages(): array
    {
        return [
            'odometer.min' => 'Odometer tidak boleh lebih kecil dari catatan maintenance / pengisian BBM terakhir (:min km).',
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
            'vehicle_model_id' => 'model 3D',
            'user_id' => 'pemilik',
            'type' => 'jenis kendaraan',
            'fuel_group' => 'jenis bahan bakar',
            'default_fuel_type_id' => 'BBM default',
            'tank_capacity' => 'kapasitas tangki',
        ];
    }
}
