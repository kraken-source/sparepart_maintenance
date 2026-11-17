<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
            $table->foreignId('part_id')->constrained()->restrictOnDelete();
            $table->enum('action', ['replace', 'repair', 'inspect'])->default('replace');
            $table->date('service_date');
            $table->unsignedInteger('odometer');
            $table->string('part_brand', 80)->nullable();   // merek sparepart yang dipasang
            $table->unsignedBigInteger('cost')->default(0); // rupiah
            $table->string('workshop', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['vehicle_id', 'part_id', 'service_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_records');
    }
};
