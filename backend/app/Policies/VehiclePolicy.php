<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Auth\Access\Response;

/**
 * Akses kendaraan: admin → semua; user biasa → kendaraan miliknya.
 * Kendaraan milik orang lain dijawab 404 (bukan 403) agar keberadaannya tidak bocor.
 * Aturan yang sama berlaku untuk catatan, lampiran, status part, dan ringkasan kendaraan tsb.
 */
class VehiclePolicy
{
    public function view(User $user, Vehicle $vehicle): Response
    {
        return $vehicle->isVisibleTo($user) ? Response::allow() : Response::denyAsNotFound('Data tidak ditemukan.');
    }

    public function create(User $user): bool
    {
        return true; // setiap user boleh menambah kendaraannya sendiri
    }

    public function update(User $user, Vehicle $vehicle): Response
    {
        return $this->view($user, $vehicle);
    }

    public function delete(User $user, Vehicle $vehicle): Response
    {
        return $this->view($user, $vehicle);
    }
}
