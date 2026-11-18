<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pencatatan bahan bakar:
     * - fuel_types   : master jenis BBM (Pertalite, Pertamax, Dexlite, …), kelompok bensin / diesel
     * - vehicles     : kelompok BBM kendaraan, jenis BBM default, kapasitas tangki
     * - fuel_logs    : setiap pengisian (tanggal, odometer, liter, harga, isi penuh/sebagian)
     *
     * Konsumsi (km/L) TIDAK disimpan: dihitung saat ditampilkan (metode tangki penuh ke tangki
     * penuh), sehingga tetap benar bila ada catatan lama yang diedit / dihapus.
     */
    public function up(): void
    {
        Schema::create('fuel_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('group', 10);                       // gasoline | diesel
            $table->unsignedSmallInteger('rating')->nullable(); // RON (bensin) / angka setana (diesel)
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('fuel_group', 10)->default('gasoline')->after('type');
            $table->foreignId('default_fuel_type_id')->nullable()->after('fuel_group')->constrained('fuel_types')->nullOnDelete();
            $table->decimal('tank_capacity', 5, 1)->nullable()->after('default_fuel_type_id');
        });

        Schema::create('fuel_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fuel_type_id')->constrained('fuel_types')->restrictOnDelete();
            $table->string('filled_on', 10);                    // YYYY-MM-DD
            $table->unsignedInteger('odometer');
            $table->decimal('liters', 7, 2);
            $table->unsignedInteger('price_per_liter');         // Rupiah
            $table->unsignedInteger('total_cost');              // Rupiah
            $table->boolean('is_full')->default(true);          // isi sampai penuh?
            $table->boolean('missed_previous')->default(false); // ada pengisian sebelumnya yang tidak dicatat?
            $table->string('station', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['vehicle_id', 'odometer']);
        });

        // Jenis BBM yang umum di Indonesia (admin bisa menambah / menonaktifkan di menu Jenis BBM).
        $now = now();
        $types = [
            ['Pertalite', 'gasoline', 90], ['Pertamax', 'gasoline', 92], ['Pertamax Green', 'gasoline', 95],
            ['Pertamax Turbo', 'gasoline', 98], ['Shell Super', 'gasoline', 92], ['Shell V-Power', 'gasoline', 95],
            ['BP 92', 'gasoline', 92], ['BP Ultimate', 'gasoline', 95],
            ['Bio Solar', 'diesel', 48], ['Dexlite', 'diesel', 51], ['Pertamina Dex', 'diesel', 53],
            ['Shell V-Power Diesel', 'diesel', null], ['BP Ultimate Diesel', 'diesel', null],
        ];
        DB::table('fuel_types')->insert(array_map(fn ($t) => [
            'name' => $t[0], 'group' => $t[1], 'rating' => $t[2], 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
        ], $types));

        // Kendaraan yang sudah ada: model bertuliskan "diesel" → diesel, selain itu bensin.
        $id = fn ($name) => DB::table('fuel_types')->where('name', $name)->value('id');
        DB::table('vehicles')->whereRaw('LOWER(model) LIKE ?', ['%diesel%'])
            ->update(['fuel_group' => 'diesel', 'default_fuel_type_id' => $id('Dexlite')]);
        DB::table('vehicles')->where('fuel_group', 'gasoline')->where('type', 'motorcycle')
            ->update(['default_fuel_type_id' => $id('Pertalite')]);
        DB::table('vehicles')->where('fuel_group', 'gasoline')->where('type', 'car')
            ->update(['default_fuel_type_id' => $id('Pertamax')]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_logs');
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_fuel_type_id');
            $table->dropColumn(['fuel_group', 'tank_capacity']);
        });
        Schema::dropIfExists('fuel_types');
    }
};
