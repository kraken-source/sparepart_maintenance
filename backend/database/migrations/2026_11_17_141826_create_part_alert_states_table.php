<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Status terakhir yang sudah diberitahukan per (kendaraan, part), agar pengingat
     * tidak dikirim berulang setiap hari untuk kondisi yang sama.
     */
    public function up(): void
    {
        Schema::create('part_alert_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('part_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20); // due_soon | overdue
            $table->dateTime('notified_at');
            $table->timestamps();

            $table->unique(['vehicle_id', 'part_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('part_alert_states');
    }
};
