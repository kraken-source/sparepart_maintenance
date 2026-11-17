<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seragamkan maintenance_records.service_date menjadi "YYYY-MM-DD".
     * Data dari seeder tersimpan "YYYY-MM-DD 00:00:00", dari API "YYYY-MM-DD".
     * Nilai tanggalnya tidak berubah, hanya formatnya (khusus SQLite; MySQL DATE sudah seragam).
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement("update maintenance_records set service_date = substr(service_date, 1, 10) where length(service_date) > 10");
        }
    }

    public function down(): void
    {
        // Tidak perlu dikembalikan: format pendek valid untuk kolom date.
    }
};
