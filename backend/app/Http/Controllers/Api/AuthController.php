<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /** POST /api/login → { token, user } */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device' => ['nullable', 'string', 'max:100'],
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'Email atau password salah.']);
        }

        // Dicek setelah password benar agar status akun tidak bisa ditebak tanpa password.
        if (! $user->is_active) {
            throw ValidationException::withMessages(['email' => 'Akun Anda dinonaktifkan. Hubungi admin.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken($data['device'] ?? 'web')->plainTextToken;

        return response()->json(['token' => $token, 'user' => $user]);
    }

    /** GET /api/me */
    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    /**
     * PUT /api/me/password – ganti password sendiri.
     * Token lain (perangkat lain) dicabut; sesi yang sedang dipakai tetap aktif.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', 'confirmed', Password::min(8), 'different:current_password'],
        ], [
            'password.different' => 'Password baru harus berbeda dari password saat ini.',
        ], [
            'current_password' => 'password saat ini',
            'password' => 'password baru',
        ]);

        $user = $request->user();
        $user->update(['password' => $data['password']]);

        $current = $user->currentAccessToken();
        $user->tokens()->when($current?->id ?? null, fn ($q, $id) => $q->where('id', '!=', $id))->delete();

        return response()->json(['message' => 'Password berhasil diganti.']);
    }

    /** POST /api/logout – mencabut token yang sedang dipakai. */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }
}
