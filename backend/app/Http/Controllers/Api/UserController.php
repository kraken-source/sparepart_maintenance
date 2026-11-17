<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Kelola pengguna (khusus admin).
 *
 * Pengaman:
 *  - admin tidak bisa menurunkan peran / menonaktifkan / menghapus dirinya sendiri
 *  - harus selalu ada minimal satu admin aktif
 *  - user yang dinonaktifkan atau di-reset password-nya langsung keluar dari semua perangkat
 */
class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => User::withCount('vehicles')->orderByDesc('is_active')->orderBy('name')->get()]);
    }

    public function store(UserRequest $request): JsonResponse
    {
        $user = User::create($request->validated() + ['is_active' => true]);

        return response()->json(['data' => $user->fresh()], 201);
    }

    public function update(UserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $self = $request->user()->is($user);
        $demote = ($data['role'] ?? $user->role) !== User::ROLE_ADMIN;
        $deactivate = array_key_exists('is_active', $data) && ! $data['is_active'];

        if ($self && ($demote || $deactivate)) {
            throw ValidationException::withMessages([
                $demote ? 'role' : 'is_active' => 'Anda tidak bisa menurunkan peran atau menonaktifkan akun Anda sendiri.',
            ]);
        }

        DB::transaction(function () use ($user, $data, $demote, $deactivate) {
            if ($user->isAdmin() && $user->is_active && ($demote || $deactivate)) {
                $this->ensureAnotherActiveAdmin($user);
            }

            $user->update($data);

            // Nonaktif atau password di-reset admin → paksa keluar dari semua perangkat.
            if (! $user->is_active || isset($data['password'])) {
                $user->tokens()->delete();
            }
        });

        return response()->json(['data' => $user->fresh()]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->is($user)) {
            abort(422, 'Anda tidak bisa menghapus akun Anda sendiri.');
        }

        // Kendaraan (dan riwayatnya) tidak boleh kehilangan pemilik.
        $vehicles = $user->vehicles()->count();
        if ($vehicles > 0) {
            abort(422, "{$user->name} masih memiliki {$vehicles} kendaraan. Pindahkan pemilik kendaraannya terlebih dahulu, atau nonaktifkan akun ini.");
        }

        DB::transaction(function () use ($user) {
            if ($user->isAdmin() && $user->is_active) {
                $this->ensureAnotherActiveAdmin($user);
            }
            $user->tokens()->delete();
            $user->notifications()->delete();
            $user->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Pengaman lapis kedua. Dalam alur normal tidak pernah terpicu, karena admin yang bertindak
     * pasti aktif dan tidak bisa mengubah dirinya sendiri. Berguna bila dua admin saling
     * menurunkan / menonaktifkan pada saat yang bersamaan.
     */
    private function ensureAnotherActiveAdmin(User $user): void
    {
        $others = User::activeAdmins()->whereKeyNot($user->id)->lockForUpdate()->count();
        if ($others === 0) {
            throw ValidationException::withMessages([
                'role' => 'Harus ada minimal satu admin aktif.',
            ]);
        }
    }
}
