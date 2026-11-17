<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Setiap kendaraan punya satu pemilik (user). User biasa hanya melihat kendaraannya sendiri;
     * admin melihat semua. Penghapusan user yang masih punya kendaraan dicegah di aplikasi.
     */
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->restrictOnDelete();
        });

        // Kendaraan yang sudah ada → milik admin pertama (yang membuatnya selama ini).
        $owner = DB::table('users')->where('role', 'admin')->orderBy('id')->value('id')
            ?? DB::table('users')->orderBy('id')->value('id');
        if ($owner) {
            DB::table('vehicles')->whereNull('user_id')->update(['user_id' => $owner]);
        }
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
