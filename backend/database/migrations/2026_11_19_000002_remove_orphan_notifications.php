<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Hapus notifikasi pengingat milik kendaraan yang sudah dihapus. Dulu notifikasi tidak ikut
     * terhapus bersama kendaraannya (sekarang ditangani event Vehicle::deleting).
     */
    public function up(): void
    {
        DB::table('notifications')
            ->whereNotNull('data->vehicle_id')
            ->whereNotIn('data->vehicle_id', DB::table('vehicles')->select('id'))
            ->delete();
    }

    public function down(): void
    {
        // Data yang terhapus tidak bisa dikembalikan.
    }
};
