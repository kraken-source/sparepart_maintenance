<?php

use App\Support\GlbInspector;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const BUILTINS = [
        'palisade' => ['Hyundai Palisade 2026', 'car'],
        'innova' => ['Toyota Kijang Innova 2012', 'car'],
        'beat' => ['Honda BeAT eSP 2021', 'motorcycle'],
    ];

    private const DEFAULT_BUILTIN = ['car' => 'palisade', 'motorcycle' => 'beat'];

    /**
     * Master model 3D. Menggantikan kolom teks bebas vehicles.model_3d_url
     * ("builtin:<key>" / URL .glb / kosong) dengan relasi vehicles.vehicle_model_id.
     *
     * Data lama dipindahkan:
     *  - kosong           → model bawaan default sesuai jenis kendaraan
     *  - builtin:<key>    → model bawaan tsb (bila jenisnya cocok; selain itu default)
     *  - /models/x.glb    → file disalin dari frontend/public ke penyimpanan + entri master baru
     */
    public function up(): void
    {
        Schema::create('vehicle_models', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            $table->string('vehicle_type', 20);
            $table->string('source', 10);                     // builtin | glb
            $table->string('builtin_key', 30)->nullable()->unique();
            $table->string('file_path')->nullable();
            $table->unsignedInteger('file_size')->nullable();
            $table->string('thumbnail_path')->nullable();
            $table->json('mesh_names')->nullable();           // nama objek di model (untuk cek kecocokan part)
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        $now = now();
        foreach (self::BUILTINS as $key => [$name, $type]) {
            DB::table('vehicle_models')->insert([
                'name' => $name, 'vehicle_type' => $type, 'source' => 'builtin', 'builtin_key' => $key,
                'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('vehicle_model_id')->nullable()->after('type')->constrained('vehicle_models')->restrictOnDelete();
        });

        $builtinId = fn (string $key) => DB::table('vehicle_models')->where('builtin_key', $key)->value('id');
        foreach (DB::table('vehicles')->get(['id', 'type', 'model_3d_url']) as $v) {
            DB::table('vehicles')->where('id', $v->id)->update(['vehicle_model_id' => $this->modelFor($v, $builtinId)]);
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn('model_3d_url');
        });
    }

    private function modelFor(object $v, callable $builtinId): int
    {
        $type = $v->type ?: 'car';
        $value = (string) $v->model_3d_url;
        $default = $builtinId(self::DEFAULT_BUILTIN[$type] ?? 'palisade');

        if ($value === '') {
            return $default;
        }
        if (str_starts_with($value, 'builtin:')) {
            $key = substr($value, 8);

            return (self::BUILTINS[$key][1] ?? null) === $type ? $builtinId($key) : $default;
        }

        // URL file .glb dari folder frontend/public → salin ke penyimpanan & daftarkan di master.
        $existing = DB::table('vehicle_models')->where('notes', 'like', "%{$value}%")->where('vehicle_type', $type)->value('id');
        if ($existing) {
            return $existing;
        }
        $source = base_path('../frontend/public/'.ltrim(parse_url($value, PHP_URL_PATH) ?? '', '/'));
        if (! str_ends_with(strtolower($source), '.glb') || ! is_file($source)) {
            return $default; // file tidak ada → pakai model bawaan, kendaraan tetap bisa ditampilkan
        }
        try {
            $meshNames = GlbInspector::inspect($source)['mesh_names'];
        } catch (\InvalidArgumentException) {
            return $default;
        }

        $path = 'vehicle-models/'.Str::uuid().'.glb';
        Storage::disk('local')->put($path, file_get_contents($source));
        $base = pathinfo($source, PATHINFO_FILENAME);
        $name = $base;
        for ($i = 2; DB::table('vehicle_models')->where('name', $name)->exists(); $i++) {
            $name = "{$base} ({$i})";
        }

        return DB::table('vehicle_models')->insertGetId([
            'name' => $name, 'vehicle_type' => $type, 'source' => 'glb',
            'file_path' => $path, 'file_size' => filesize($source), 'mesh_names' => json_encode($meshNames),
            'is_active' => true, 'notes' => "Dipindahkan otomatis dari {$value}",
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('model_3d_url')->nullable()->after('odometer');
        });
        foreach (DB::table('vehicles')->join('vehicle_models', 'vehicle_models.id', '=', 'vehicles.vehicle_model_id')
            ->get(['vehicles.id', 'vehicle_models.builtin_key']) as $v) {
            DB::table('vehicles')->where('id', $v->id)->update(['model_3d_url' => $v->builtin_key ? "builtin:{$v->builtin_key}" : null]);
        }
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_model_id');
        });
        Schema::dropIfExists('vehicle_models');
    }
};
