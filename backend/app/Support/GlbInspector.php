<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Membaca file glTF biner (.glb) tanpa library: memastikan formatnya benar dan
 * mengambil nama-nama objek (node & mesh) di dalamnya.
 *
 * Nama objek dibersihkan dengan aturan yang sama seperti three.js
 * (PropertyBinding.sanitizeNodeName: spasi → "_", karakter [ ] . : / dihapus), karena
 * viewer mencocokkan nama objek itu dengan mesh_name di master Part.
 *
 * Struktur GLB: header 12 byte ("glTF", versi 2, panjang total) lalu chunk pertama
 * bertipe JSON yang berisi daftar nodes / meshes.
 */
class GlbInspector
{
    private const MAGIC = 0x46546C67;      // "glTF"

    private const CHUNK_JSON = 0x4E4F534A; // "JSON"

    /** @return array{mesh_names: list<string>, version: int} */
    public static function inspect(string $path): array
    {
        $handle = @fopen($path, 'rb');
        if (! $handle) {
            throw new InvalidArgumentException('File tidak bisa dibaca.');
        }

        try {
            $header = fread($handle, 20);
            if (strlen($header) < 20) {
                throw new InvalidArgumentException('File terlalu kecil untuk file .glb.');
            }
            ['magic' => $magic, 'version' => $version, 'chunkLength' => $chunkLength, 'chunkType' => $chunkType]
                = unpack('Vmagic/Vversion/Vlength/VchunkLength/VchunkType', $header);

            if ($magic !== self::MAGIC) {
                throw new InvalidArgumentException('Bukan file glTF biner (.glb) yang valid.');
            }
            if ($version !== 2) {
                throw new InvalidArgumentException("Versi glTF {$version} tidak didukung, gunakan glTF 2.0.");
            }
            if ($chunkType !== self::CHUNK_JSON || $chunkLength <= 0 || $chunkLength > 64 * 1024 * 1024) {
                throw new InvalidArgumentException('Struktur file .glb rusak (bagian JSON tidak ditemukan).');
            }

            $json = json_decode(fread($handle, $chunkLength), true);
            if (! is_array($json)) {
                throw new InvalidArgumentException('Struktur file .glb rusak (JSON tidak terbaca).');
            }
        } finally {
            fclose($handle);
        }

        $names = [];
        foreach (['nodes', 'meshes'] as $key) {
            foreach ($json[$key] ?? [] as $item) {
                if (is_array($item) && isset($item['name']) && is_string($item['name'])) {
                    $name = self::sanitize($item['name']);
                    if ($name !== '') {
                        $names[$name] = true;
                    }
                }
            }
        }
        $names = array_keys($names);
        sort($names);

        return ['mesh_names' => $names, 'version' => $version];
    }

    /** Sama dengan THREE.PropertyBinding.sanitizeNodeName. */
    public static function sanitize(string $name): string
    {
        return preg_replace('/[\[\]\.:\/]/', '', preg_replace('/\s/', '_', $name));
    }
}
