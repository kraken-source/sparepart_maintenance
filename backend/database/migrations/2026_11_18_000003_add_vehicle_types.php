<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Jenis kendaraan (mobil / sepeda motor). Part berlaku untuk satu jenis, dan nama mesh
     * cukup unik per jenis (mis. "engine_oil" ada di mobil dan motor dengan interval berbeda).
     * Semua data lama adalah mobil.
     */
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('type', 20)->default('car')->after('user_id');
        });

        Schema::table('parts', function (Blueprint $table) {
            $table->string('vehicle_type', 20)->default('car')->after('id');
            $table->dropUnique(['mesh_name']);
            $table->unique(['vehicle_type', 'mesh_name']);
        });
    }

    public function down(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            $table->dropUnique(['vehicle_type', 'mesh_name']);
            $table->unique('mesh_name');
            $table->dropColumn('vehicle_type');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
