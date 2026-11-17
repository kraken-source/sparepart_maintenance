<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('category', 50);
            // Nama mesh di model 3D. Klik mesh di dashboard -> cari part dengan mesh_name ini.
            $table->string('mesh_name', 80)->unique();
            // Interval penggantian; jatuh tempo = mana yang lebih dulu tercapai.
            $table->unsignedInteger('interval_km')->nullable();
            $table->unsignedInteger('interval_days')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parts');
    }
};
