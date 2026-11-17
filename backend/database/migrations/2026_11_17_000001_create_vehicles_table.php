<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number', 20)->unique();
            $table->string('brand', 50);
            $table->string('model', 80);
            $table->unsignedSmallInteger('year')->nullable();
            $table->unsignedInteger('odometer')->default(0); // km terakhir yang diketahui
            $table->string('model_3d_url')->nullable();       // mis. /models/palisade.glb
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
