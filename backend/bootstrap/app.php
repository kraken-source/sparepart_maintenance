<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
    })
    ->withExceptions(function (Exceptions $exceptions) {
        /*
         * Pesan error API dalam Bahasa Indonesia agar seragam dengan pesan validasi (lang/id).
         * Pesan khusus yang sudah ditulis di kode (mis. abort(404, '...')) tetap dipakai.
         */
        $json = fn (string $message, int $status, array $headers = []) => response()->json(['message' => $message], $status, $headers);
        $isApi = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($json, $isApi) {
            return $isApi($request) ? $json('Sesi login berakhir. Silakan masuk kembali.', 401) : null;
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($json, $isApi) {
            if (! $isApi($request)) {
                return null;
            }
            $seconds = (int) ($e->getHeaders()['Retry-After'] ?? 60);

            return $json("Terlalu banyak permintaan. Coba lagi dalam {$seconds} detik.", 429, $e->getHeaders());
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($json, $isApi) {
            if (! $isApi($request)) {
                return null;
            }
            $message = $e->getMessage();
            $english = $message === '' || $e->getPrevious() instanceof ModelNotFoundException || str_starts_with($message, 'The route');

            return $json($english ? 'Data tidak ditemukan.' : $message, 404);
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) use ($json, $isApi) {
            return $isApi($request) ? $json('Anda tidak memiliki akses untuk tindakan ini.', 403) : null;
        });

        $exceptions->render(function (MethodNotAllowedHttpException $e, Request $request) use ($json, $isApi) {
            return $isApi($request) ? $json('Metode permintaan tidak diizinkan.', 405) : null;
        });

        $exceptions->render(function (PostTooLargeException $e, Request $request) use ($json, $isApi) {
            return $isApi($request) ? $json('Ukuran data atau file yang dikirim terlalu besar.', 413) : null;
        });

        // Error server tak terduga: di mode produksi jangan tampilkan detail teknis.
        $exceptions->render(function (Throwable $e, Request $request) use ($json, $isApi) {
            if (! $isApi($request) || config('app.debug') || $e instanceof HttpExceptionInterface || $e instanceof ValidationException) {
                return null;
            }

            return $json('Terjadi kesalahan pada server. Silakan coba lagi.', 500);
        });
    })->create();
