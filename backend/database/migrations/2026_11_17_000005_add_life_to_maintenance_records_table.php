<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            // Usia pakai part yang dipasang pada penggantian ini. Null keduanya = ikut interval default part.
            $table->unsignedInteger('life_km')->nullable()->after('odometer');
            $table->unsignedSmallInteger('life_months')->nullable()->after('life_km');
        });
    }

    public function down(): void
    {
        Schema::table('maintenance_records', function (Blueprint $table) {
            $table->dropColumn(['life_km', 'life_months']);
        });
    }
};
