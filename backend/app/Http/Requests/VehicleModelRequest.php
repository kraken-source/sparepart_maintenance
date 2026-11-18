<?php

namespace App\Http\Requests;

use App\Models\Vehicle;
use App\Models\VehicleModel;
use App\Support\GlbInspector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Tambah / ubah model 3D (khusus admin; dicek di route).
 * Model baru selalu berupa file .glb. Model bawaan hanya bisa diubah nama, catatan, dan status aktifnya.
 */
class VehicleModelRequest extends FormRequest
{
    /** Batas ukuran file .glb (KB) – model besar berat dibuka di HP. */
    public const MAX_FILE_KB = 20480;

    /** @var array{mesh_names: list<string>}|null hasil pembacaan file .glb */
    public ?array $glb = null;

    public function rules(): array
    {
        /** @var VehicleModel|null $model */
        $model = $this->route('vehicle_model');
        $builtin = $model?->isBuiltin();

        return [
            'name' => ['required', 'string', 'max:80', Rule::unique('vehicle_models', 'name')->ignore($model?->id)],
            'vehicle_type' => [
                $builtin ? 'sometimes' : 'required',
                Rule::in(array_keys(Vehicle::TYPES)),
                function ($attribute, $value, $fail) use ($model, $builtin) {
                    if (! $model || $model->vehicle_type === $value) {
                        return;
                    }
                    if ($builtin) {
                        $fail('Jenis kendaraan model bawaan tidak bisa diubah.');
                    } elseif ($used = $model->vehicles()->count()) {
                        $fail("Jenis kendaraan tidak bisa diubah karena model ini dipakai {$used} kendaraan.");
                    }
                },
            ],
            // File wajib saat menambah; saat mengubah opsional (= ganti file). Bawaan tidak punya file.
            'file' => [
                $builtin ? 'prohibited' : ($model ? 'nullable' : 'required'),
                'file', 'extensions:glb', 'max:'.self::MAX_FILE_KB,
            ],
            'thumbnail' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** Pastikan isi file benar-benar .glb (bukan sekadar nama berakhiran .glb), sekaligus baca nama objeknya. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->has('file') || ! $this->hasFile('file')) {
                    return;
                }
                try {
                    $this->glb = GlbInspector::inspect($this->file('file')->getRealPath());
                } catch (\InvalidArgumentException $e) {
                    $validator->errors()->add('file', $e->getMessage());
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'file.extensions' => 'File model harus berformat .glb (glTF biner).',
            'file.max' => 'Ukuran file model maksimal '.(self::MAX_FILE_KB / 1024).' MB.',
            'file.prohibited' => 'Model bawaan tidak memakai file.',
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nama model', 'vehicle_type' => 'jenis kendaraan', 'file' => 'file model',
            'thumbnail' => 'thumbnail', 'is_active' => 'status aktif', 'notes' => 'catatan',
        ];
    }
}
