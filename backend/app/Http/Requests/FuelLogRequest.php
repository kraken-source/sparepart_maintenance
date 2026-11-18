<?php

namespace App\Http\Requests;

use App\Models\FuelLog;
use App\Models\FuelType;
use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FuelLogRequest extends FormRequest
{
    /** Edit pengisian: kendaraannya harus milik user (atau user admin) – dicek sebelum validasi. */
    public function authorize(): bool
    {
        $log = $this->route('fuel_log');
        if ($log) {
            Gate::authorize('update', $log->vehicle);
        }

        return true;
    }

    public function rules(): array
    {
        $user = $this->user();
        /** @var FuelLog|null $current */
        $current = $this->route('fuel_log');

        return [
            // Hanya kendaraan yang boleh dilihat user (milik sendiri; admin: semua).
            'vehicle_id' => ['required', 'integer', Rule::exists('vehicles', 'id')->where(
                fn ($q) => $user->isAdmin() ? $q : $q->where('user_id', $user->id),
            )],
            'fuel_type_id' => ['required', 'integer', 'exists:fuel_types,id', function ($attribute, $value, $fail) use ($current) {
                $type = FuelType::find($value);
                $vehicle = Vehicle::find($this->input('vehicle_id'));
                if (! $type || ! $vehicle) {
                    return;
                }
                // Jenis nonaktif masih boleh untuk catatan lama yang memang memakainya.
                if (! $type->is_active && $current?->fuel_type_id !== $type->id) {
                    $fail("Jenis BBM {$type->name} sudah tidak aktif.");
                }
                if ($type->group !== $vehicle->fuel_group) {
                    $fail("{$type->name} adalah BBM ".strtolower(FuelType::GROUPS[$type->group] ?? $type->group)
                        .', sedangkan kendaraan ini memakai '.strtolower(FuelType::GROUPS[$vehicle->fuel_group] ?? $vehicle->fuel_group).'.');
                }
            }],
            'filled_on' => ['required', 'date', 'before_or_equal:today'],
            'odometer' => ['required', 'integer', 'min:0', 'max:9999999', $this->chronologicalOdometer($current)],
            // Cukup isi dua dari tiga: liter, harga per liter, total bayar (yang ketiga dihitung).
            'liters' => ['nullable', 'numeric', 'gt:0', 'max:999'],
            'price_per_liter' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'total_cost' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'is_full' => ['sometimes', 'boolean'],
            'missed_previous' => ['sometimes', 'boolean'],
            'station' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Odometer harus sejalan dengan tanggal: tidak lebih kecil dari pengisian di tanggal sebelumnya
     * dan tidak lebih besar dari pengisian di tanggal sesudahnya (catatan lama boleh disisipkan).
     */
    private function chronologicalOdometer(?FuelLog $current): \Closure
    {
        return function ($attribute, $value, $fail) use ($current) {
            $date = strtotime((string) $this->input('filled_on')) ? Carbon::parse($this->input('filled_on'))->toDateString() : null;
            if (! $date || ! $this->input('vehicle_id')) {
                return;
            }
            $others = FuelLog::where('vehicle_id', $this->input('vehicle_id'))
                ->when($current, fn ($q) => $q->whereKeyNot($current->id));

            $before = (clone $others)->where('filled_on', '<', $date)->orderByDesc('odometer')->first();
            if ($before && $value < $before->odometer) {
                $fail('Odometer lebih kecil dari pengisian sebelumnya ('.number_format($before->odometer, 0, ',', '.')
                    .' km pada '.Carbon::parse($before->filled_on)->translatedFormat('d M Y').').');

                return;
            }
            $after = (clone $others)->where('filled_on', '>', $date)->orderBy('odometer')->first();
            if ($after && $value > $after->odometer) {
                $fail('Odometer lebih besar dari pengisian sesudahnya ('.number_format($after->odometer, 0, ',', '.')
                    .' km pada '.Carbon::parse($after->filled_on)->translatedFormat('d M Y').').');
            }
        };
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $filled = collect(['liters', 'price_per_liter', 'total_cost'])->filter(fn ($k) => filled($this->input($k)));
                if ($filled->count() < 2 && ! $validator->errors()->hasAny(['liters', 'price_per_liter', 'total_cost'])) {
                    $validator->errors()->add('liters', 'Isi minimal dua dari: liter, harga per liter, total bayar.');
                }
            },
        ];
    }

    /** Data tervalidasi + nilai ketiga yang dihitung dari dua nilai lainnya. */
    public function payload(): array
    {
        $data = $this->validated();
        $liters = isset($data['liters']) ? (float) $data['liters'] : null;
        $price = $data['price_per_liter'] ?? null;
        $total = $data['total_cost'] ?? null;

        if ($liters === null) {
            $liters = round($total / $price, 2);
        } elseif ($total === null) {
            $total = (int) round($liters * $price);
        } elseif ($price === null) {
            $price = (int) round($total / $liters);
        }

        return ['liters' => $liters, 'price_per_liter' => $price, 'total_cost' => $total] + $data;
    }

    public function messages(): array
    {
        return [
            'filled_on.before_or_equal' => 'Tanggal pengisian tidak boleh melebihi hari ini.',
        ];
    }

    public function attributes(): array
    {
        return [
            'vehicle_id' => 'kendaraan',
            'fuel_type_id' => 'jenis BBM',
            'filled_on' => 'tanggal pengisian',
            'odometer' => 'odometer',
            'liters' => 'liter',
            'price_per_liter' => 'harga per liter',
            'total_cost' => 'total bayar',
            'is_full' => 'isi penuh',
            'missed_previous' => 'pengisian terlewat',
            'station' => 'SPBU',
            'notes' => 'catatan',
        ];
    }
}
