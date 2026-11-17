<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tolak request dari akun yang dinonaktifkan (lapisan kedua; saat dinonaktifkan semua tokennya
 * juga sudah dicabut). Token yang masih dipakai ikut dicabut di sini.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $token = $user->currentAccessToken();
            if ($token instanceof PersonalAccessToken) {
                $token->delete();
            }

            return response()->json(['message' => 'Akun Anda dinonaktifkan. Hubungi admin.'], 401);
        }

        return $next($request);
    }
}
