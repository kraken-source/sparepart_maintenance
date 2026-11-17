<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Tidak ada halaman registrasi: user dibuat oleh pengelola lewat perintah ini.
 *   php artisan user:create "Nama User" email@contoh.com
 * Jika email sudah ada, password user tersebut di-reset.
 */
Artisan::command('user:create {name} {email}', function (string $name, string $email) {
    $password = $this->secret('Password (min. 8 karakter)');

    $validator = Validator::make(
        ['email' => $email, 'password' => $password],
        ['email' => ['required', 'email'], 'password' => ['required', 'string', 'min:8']],
    );
    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }

    $user = User::updateOrCreate(['email' => strtolower($email)], ['name' => $name, 'password' => $password]);
    $user->tokens()->delete(); // paksa login ulang di semua perangkat

    $this->info(($user->wasRecentlyCreated ? 'User dibuat: ' : 'Password di-reset: ').$user->email);

    return 0;
})->purpose('Buat user baru atau reset password user');
