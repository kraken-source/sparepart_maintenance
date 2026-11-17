<?php

use App\Models\User;
use App\Services\DueReminderService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;

/*
 * Pengingat jatuh tempo part. Dijalankan otomatis setiap hari 07:00 (zona waktu aplikasi),
 * juga bisa manual: php artisan maintenance:check-due
 */
Artisan::command('maintenance:check-due', function (DueReminderService $reminders) {
    $n = $reminders->check();
    $this->info("Pemeriksaan selesai: {$n} kendaraan mendapat notifikasi.");
})->purpose('Periksa part yang mendekati/melewati jadwal ganti dan buat notifikasi');

Schedule::command('maintenance:check-due')->dailyAt('07:00')->withoutOverlapping();

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Pengguna dikelola admin di menu Pengguna. Perintah ini jalur darurat dari terminal,
 * mis. membuat admin pertama atau memulihkan akses bila semua admin lupa password:
 *   php artisan user:create "Nama User" email@contoh.com [--admin]
 * Jika email sudah ada: password di-reset dan akun diaktifkan kembali.
 */
Artisan::command('user:create {name} {email} {--admin : Jadikan admin}', function (string $name, string $email) {
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

    $attrs = ['name' => $name, 'password' => $password, 'is_active' => true];
    if ($this->option('admin')) {
        $attrs['role'] = User::ROLE_ADMIN;
    }
    $user = User::updateOrCreate(['email' => strtolower($email)], $attrs);
    $user->tokens()->delete(); // paksa login ulang di semua perangkat

    $this->info(($user->wasRecentlyCreated ? 'User dibuat: ' : 'Password di-reset: ')."{$user->email} (peran: {$user->role})");

    return 0;
})->purpose('Buat user baru atau reset password user');
