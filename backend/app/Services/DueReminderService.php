<?php

namespace App\Services;

use App\Models\PartAlertState;
use App\Models\User;
use App\Models\Vehicle;
use App\Notifications\VehicleMaintenanceDue;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Memeriksa part yang mendekati / melewati jadwal ganti dan membuat notifikasi.
 *
 * Aturan anti-spam:
 *  - Notifikasi dibuat saat part BARU masuk status "due_soon" atau "overdue" (termasuk naik dari due_soon → overdue).
 *  - Part yang tetap "overdue" diingatkan ulang setiap REMIND_OVERDUE_DAYS hari.
 *  - Bila part kembali "ok" (sudah diganti) status pengingatnya dihapus, sehingga siklus berikutnya terdeteksi lagi.
 *  - Satu notifikasi per kendaraan per pemeriksaan, berisi semua part yang perlu diberitahukan.
 */
class DueReminderService
{
    public const REMIND_OVERDUE_DAYS = 7;

    private const ALERT_STATUSES = ['due_soon', 'overdue'];

    public function __construct(private PartStatusService $status) {}

    /**
     * @return int jumlah kendaraan yang menghasilkan notifikasi
     */
    public function check(?Vehicle $only = null, ?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $vehicles = $only ? collect([$only->fresh()]) : Vehicle::orderBy('plate_number')->get();
        $sent = 0;

        foreach ($vehicles as $vehicle) {
            $items = DB::transaction(fn () => $this->collectAlerts($vehicle, $now));

            if ($items) {
                Notification::send($this->recipients($vehicle), new VehicleMaintenanceDue($vehicle, $items));
                $sent++;
            }
        }

        return $sent;
    }

    /** Penerima: pemilik kendaraan + semua admin aktif (admin melihat semua kendaraan). */
    private function recipients(Vehicle $vehicle)
    {
        return User::where('is_active', true)
            ->where(fn ($q) => $q->where('role', User::ROLE_ADMIN)->orWhere('id', $vehicle->user_id))
            ->get();
    }

    /** Tentukan part mana yang perlu diberitahukan, sekaligus perbarui status pengingatnya. */
    private function collectAlerts(Vehicle $vehicle, Carbon $now): array
    {
        $states = PartAlertState::where('vehicle_id', $vehicle->id)->get()->keyBy('part_id');
        $items = [];

        foreach ($this->status->forVehicle($vehicle, $now->copy()->startOfDay()) as $p) {
            $state = $states->get($p['id']);

            if (! in_array($p['status'], self::ALERT_STATUSES, true)) {
                $state?->delete(); // sudah aman / belum ada data → reset
                continue;
            }

            $isNew = ! $state || $state->status !== $p['status'];
            $isReminder = ! $isNew
                && $p['status'] === 'overdue'
                && $state->notified_at->lte($now->copy()->subDays(self::REMIND_OVERDUE_DAYS));

            if (! $isNew && ! $isReminder) {
                continue;
            }

            PartAlertState::updateOrCreate(
                ['vehicle_id' => $vehicle->id, 'part_id' => $p['id']],
                ['status' => $p['status'], 'notified_at' => $now],
            );

            $items[] = [
                'part_id' => $p['id'],
                'mesh_name' => $p['mesh_name'],
                'name' => $p['name'],
                'status' => $p['status'],
                'detail' => PartStatusService::remainingText($p),
                'reminder' => $isReminder,
            ];
        }

        // Yang paling mendesak di atas
        usort($items, fn ($a, $b) => ($a['status'] === 'overdue' ? 0 : 1) <=> ($b['status'] === 'overdue' ? 0 : 1));

        return $items;
    }

    /** Dipanggil setelah data berubah; kegagalan pengingat tidak boleh menggagalkan penyimpanan. */
    public function checkQuietly(Vehicle|int $vehicle): void
    {
        try {
            $this->check($vehicle instanceof Vehicle ? $vehicle : Vehicle::find($vehicle));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
