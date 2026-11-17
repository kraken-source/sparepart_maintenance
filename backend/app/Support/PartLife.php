<?php

namespace App\Support;

use App\Models\MaintenanceRecord;
use App\Models\Part;
use Illuminate\Support\Carbon;

/**
 * Menghitung jadwal ganti berikutnya dari sebuah catatan penggantian.
 *
 * Usia pakai diambil dari catatan (life_km / life_months) bila salah satunya diisi;
 * jika keduanya kosong, dipakai interval default part (interval_km / interval_days).
 * Jatuh tempo = batas km atau batas waktu, mana yang tercapai lebih dulu.
 */
final class PartLife
{
    /** Ambang "segera": sisa jarak/waktu <= 15% dari usia pakai. */
    public const DUE_SOON_RATIO = 0.15;

    /**
     * @return array{source: string, life_km: ?int, life_months: ?int, life_days: ?int, next_km: ?int,
     *               next_date: ?string, remaining_km: ?int, remaining_days: ?int, used_ratio: ?float, status: string}
     */
    public static function evaluate(MaintenanceRecord $record, Part $part, int $currentOdometer, ?Carbon $today = null): array
    {
        $today ??= Carbon::today();
        $fromRecord = $record->life_km !== null || $record->life_months !== null;

        $lifeKm = $fromRecord ? $record->life_km : $part->interval_km;
        $lifeMonths = $fromRecord ? $record->life_months : null;
        $lifeDays = $fromRecord ? null : $part->interval_days;

        $ratios = [];
        $nextKm = $remainingKm = $nextDate = $remainingDays = null;

        if ($lifeKm) {
            $nextKm = $record->odometer + $lifeKm;
            $remainingKm = $nextKm - $currentOdometer;
            $ratios[] = $remainingKm / $lifeKm;
        }

        if ($lifeMonths || $lifeDays) {
            $start = $record->service_date->copy()->startOfDay();
            $next = $lifeMonths ? $start->copy()->addMonthsNoOverflow($lifeMonths) : $start->copy()->addDays($lifeDays);
            $totalDays = max(1, (int) $start->diffInDays($next));
            $remainingDays = (int) $today->diffInDays($next, false);
            $nextDate = $next->toDateString();
            $ratios[] = $remainingDays / $totalDays;
        }

        $status = 'ok';
        $usedRatio = null;
        if ($ratios) {
            $worst = min($ratios);
            $status = $worst <= 0 ? 'overdue' : ($worst <= self::DUE_SOON_RATIO ? 'due_soon' : 'ok');
            $usedRatio = round(1 - $worst, 3); // 0 = baru dipasang, 1 = tepat jatuh tempo, >1 = lewat
        }

        return [
            'source' => $fromRecord ? 'record' : 'part',
            'life_km' => $lifeKm,
            'life_months' => $lifeMonths,
            'life_days' => $lifeDays,
            'next_km' => $nextKm,
            'next_date' => $nextDate,
            'remaining_km' => $remainingKm,
            'remaining_days' => $remainingDays,
            'used_ratio' => $usedRatio,
            'status' => $status,
        ];
    }
}
