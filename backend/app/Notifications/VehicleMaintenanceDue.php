<?php

namespace App\Notifications;

use App\Models\Vehicle;
use Illuminate\Notifications\Notification;

/**
 * Pengingat part kendaraan yang mendekati / melewati jadwal ganti.
 *
 * Saat ini hanya disimpan di database (lonceng notifikasi di aplikasi).
 * Saluran lain (mis. Telegram, email) cukup ditambahkan di via() + method toXxx().
 */
class VehicleMaintenanceDue extends Notification
{
    /**
     * @param  array<int, array{part_id:int, mesh_name:string, name:string, status:string, detail:string, reminder:bool}>  $items
     */
    public function __construct(public Vehicle $vehicle, public array $items) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $overdue = count(array_filter($this->items, fn ($i) => $i['status'] === 'overdue'));
        $dueSoon = count($this->items) - $overdue;

        $summary = implode(', ', array_filter([
            $overdue ? "{$overdue} part lewat jadwal" : null,
            $dueSoon ? "{$dueSoon} part segera diganti" : null,
        ]));

        return [
            'vehicle_id' => $this->vehicle->id,
            'plate_number' => $this->vehicle->plate_number,
            'vehicle_name' => trim("{$this->vehicle->brand} {$this->vehicle->model}"),
            'level' => $overdue ? 'overdue' : 'due_soon',
            'title' => "{$this->vehicle->plate_number}: {$summary}",
            'items' => $this->items,
        ];
    }
}
