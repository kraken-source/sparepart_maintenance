<?php

namespace App\Exports;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Laporan biaya → file Excel (.xlsx) dengan beberapa sheet.
 * Isi diambil dari CostReportService::build() sehingga sama dengan halaman laporan.
 */
class CostReportExport
{
    private const RUPIAH = '"Rp" #,##0';

    private const ACTIONS = ['replace' => 'Ganti', 'repair' => 'Perbaikan', 'inspect' => 'Pengecekan'];

    public function __construct(private array $report) {}

    public function filename(): string
    {
        $f = $this->report['filter'];
        $owner = $f['owner'] ? '_'.(\Illuminate\Support\Str::slug($f['owner']['name']) ?: 'pemilik'.$f['owner']['id']) : '';
        $plate = $f['vehicle'] ? '_'.str_replace(' ', '', $f['vehicle']['plate_number']) : '';

        return "laporan-biaya_{$f['from']}_{$f['to']}{$owner}{$plate}.xlsx";
    }

    /** Tulis ke file sementara dan kembalikan path-nya. */
    public function store(): string
    {
        $book = new Spreadsheet;
        $book->getProperties()->setTitle('Laporan Biaya Kendaraan')->setCreator('Sparepart Maintenance');

        $this->summarySheet($book->getActiveSheet());
        $this->monthlySheet($book->createSheet());
        $this->partSheet($book->createSheet());
        $this->detailSheet($book->createSheet());
        if ($this->report['filter']['include_fuel']) {
            $this->fuelSheet($book->createSheet());
        }
        $book->setActiveSheetIndex(0);

        $path = tempnam(sys_get_temp_dir(), 'xlsx');
        (new Xlsx($book))->save($path);

        return $path;
    }

    private function summarySheet(Worksheet $s): void
    {
        $r = $this->report;
        $f = $r['filter'];
        $s->setTitle('Ringkasan');

        $fuel = $f['include_fuel'];
        $s->setCellValue('A1', $fuel ? 'Laporan Biaya Kendaraan (Maintenance + BBM)' : 'Laporan Biaya Maintenance')
            ->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        // Susunan baris tetap (Total biaya selalu di B8) agar mudah dirujuk rumus lain.
        $rows = [
            ['Periode', "{$f['from']} s/d {$f['to']}"],
            ['Pemilik', $f['owner'] ? "{$f['owner']['name']} ({$f['owner']['email']})" : ($r['with_owners'] ? 'Semua pemilik' : 'Kendaraan milik sendiri')],
            ['Kendaraan', $f['vehicle'] ? "{$f['vehicle']['plate_number']} – {$f['vehicle']['brand']} {$f['vehicle']['model']}" : 'Semua kendaraan'],
            ['Dibuat', now()->format('Y-m-d H:i')],
            [],
            ['Total biaya', $r['summary']['total']],
            ['Biaya maintenance', $r['summary']['maintenance_total']],
            ['Biaya bahan bakar', $fuel ? $r['summary']['fuel_total'] : 'tidak disertakan'],
            ['Jumlah catatan maintenance', $r['summary']['count']],
            ['Jumlah pengisian BBM', $fuel ? $r['summary']['fuel_fills'] : '-'],
            ['Jumlah bulan', $r['summary']['months']],
            ['Rata-rata per bulan', $r['summary']['avg_per_month']],
        ];
        $s->fromArray($rows, null, 'A3', true);
        foreach (['B8', 'B9', 'B10', 'B14'] as $c) {
            $s->getStyle($c)->getNumberFormat()->setFormatCode(self::RUPIAH);
        }

        $row = 16;
        $owners = $r['with_owners'];
        if ($owners && ! $f['owner']) {
            $row = $this->namedTable($s, $row, 'Biaya per pemilik', array_map(fn ($o) => array_merge(
                ['Pemilik' => $o['name'], 'Email' => $o['email'], 'Kendaraan' => $o['vehicles'], 'Catatan maintenance' => $o['count']],
                $fuel ? ['Pengisian BBM' => $o['fuel_fills'], 'Maintenance' => $o['maintenance'], 'BBM' => $o['fuel']] : [],
                ['Total biaya' => $o['total'], 'Porsi' => $o['share']],
            ), $r['by_owner']->all())) + 1;
        }

        $row = $this->namedTable($s, $row, 'Biaya per kategori', array_map(fn ($c) => [
            'Kategori' => $c['category'], 'Jumlah' => $c['count'], 'Total biaya' => $c['total'], 'Porsi' => $c['share'],
        ], $r['by_category']->all())) + 1;

        $row = $this->namedTable($s, $row, 'Biaya per kendaraan', array_map(fn ($v) => array_merge(
            ['Plat' => $v['plate_number'], 'Kendaraan' => $v['name']],
            $owners ? ['Pemilik' => $v['owner']] : [],
            ['Catatan maintenance' => $v['count']],
            $fuel ? [
                'Pengisian BBM' => $v['fuel_fills'], 'Maintenance' => $v['maintenance'], 'BBM' => $v['fuel'],
                'Liter BBM' => $v['fuel_liters'], 'Konsumsi (km/L)' => $v['km_per_liter'],
            ] : [],
            ['Total biaya' => $v['total'], 'Porsi' => $v['share']],
        ), $r['by_vehicle']->all())) + 1;

        if ($fuel && $r['fuel']['fills'] > 0) {
            $this->namedTable($s, $row, 'Bahan bakar per jenis', array_map(fn ($t) => [
                'Jenis BBM' => $t['name'], 'Pengisian BBM' => $t['fills'], 'Liter BBM' => $t['liters'], 'Total biaya' => $t['total'], 'Porsi' => $t['share'],
            ], $r['fuel']['by_type']->all()));
        }

        $this->autosize($s, 12);
    }

    /** Format angka per nama kolom – dipakai tabel yang kolomnya berubah sesuai filter. */
    private const COLUMN_FORMATS = [
        'Total biaya' => self::RUPIAH, 'Maintenance' => self::RUPIAH, 'BBM' => self::RUPIAH, 'Biaya' => self::RUPIAH,
        'Harga/L' => self::RUPIAH, 'Total bayar' => self::RUPIAH, 'Porsi' => '0.0%', 'Odometer (km)' => '#,##0',
        'Liter BBM' => '#,##0.00', 'Liter' => '#,##0.00', 'Konsumsi (km/L)' => '0.0',
    ];

    /** Tabel dari baris asosiatif (kunci = judul kolom). Tabel kosong tetap menampilkan judul. */
    private function namedTable(Worksheet $s, int $row, ?string $title, array $rows, ?array $header = null): int
    {
        $header ??= array_keys($rows[0] ?? []);
        $formats = [];
        foreach ($header as $i => $name) {
            if (isset(self::COLUMN_FORMATS[$name])) {
                $formats[$i + 1] = self::COLUMN_FORMATS[$name];
            }
        }

        return $this->table($s, $row, $title, $header, array_map('array_values', $rows), $formats);
    }

    private function monthlySheet(Worksheet $s): void
    {
        $s->setTitle('Per Bulan');
        $cats = $this->report['categories']->all();
        $fuel = $this->report['filter']['include_fuel'];
        $lead = $fuel ? ['Bulan', 'Catatan maintenance', 'Pengisian BBM'] : ['Bulan', 'Jumlah catatan'];
        $rows = array_map(
            fn ($m) => array_merge(
                [$m['label'], $m['count']], $fuel ? [$m['fuel_fills']] : [],
                array_map(fn ($c) => $m['by_category'][$c] ?? 0, $cats), [$m['total']],
            ),
            $this->report['monthly'],
        );
        $rupiah = [];
        for ($i = count($lead) + 1; $i <= count($lead) + count($cats) + 1; $i++) {
            $rupiah[$i] = self::RUPIAH;
        }
        $this->table($s, 1, null, array_merge($lead, $cats, ['Total']), $rows, $rupiah);
        $this->autosize($s, count($lead) + count($cats) + 1);
    }

    private function partSheet(Worksheet $s): void
    {
        $s->setTitle('Per Part');
        $rows = array_map(fn ($p) => [$p['name'], $p['category'], $p['count'], $p['total'], $p['share']], $this->report['by_part']->all());
        $this->table($s, 1, '10 part dengan biaya terbesar', ['Part', 'Kategori', 'Jumlah catatan', 'Total biaya', 'Porsi'], $rows, [4 => self::RUPIAH, 5 => '0.0%']);
        $this->autosize($s, 5);
    }

    private function detailSheet(Worksheet $s): void
    {
        $s->setTitle('Detail');
        // Kolom Pemilik (setelah Plat) hanya untuk admin.
        $owners = $this->report['with_owners'];
        $rows = array_map(fn ($r) => [
            $r['service_date'], $r['plate_number'], ...($owners ? [$r['owner']] : []), $r['part'], $r['category'],
            self::ACTIONS[$r['action']] ?? $r['action'], $r['odometer'], $r['part_brand'], $r['workshop'], $r['cost'],
        ], $this->report['records']->all());
        $header = ['Tanggal', 'Plat', ...($owners ? ['Pemilik'] : []), 'Part', 'Kategori', 'Tindakan', 'Odometer (km)', 'Merek part', 'Bengkel', 'Biaya'];
        $shift = $owners ? 1 : 0;
        $this->table($s, 1, null, $header, $rows, [6 + $shift => '#,##0', 9 + $shift => self::RUPIAH]);
        $s->freezePane('A2');
        $s->setAutoFilter($s->calculateWorksheetDimension());
        $this->autosize($s, count($header));
    }

    /** Rincian pengisian bahan bakar. */
    private function fuelSheet(Worksheet $s): void
    {
        $s->setTitle('BBM');
        $owners = $this->report['with_owners'];
        $header = ['Tanggal', 'Plat', ...($owners ? ['Pemilik'] : []), 'Jenis BBM', 'Odometer (km)', 'Liter', 'Harga/L', 'Total bayar', 'Isi', 'SPBU'];
        $rows = array_map(fn ($l) => array_combine($header, [
            $l['filled_on'], $l['plate_number'], ...($owners ? [$l['owner']] : []), $l['fuel_type'], $l['odometer'],
            $l['liters'], $l['price_per_liter'], $l['total_cost'], $l['is_full'] ? 'Penuh' : 'Sebagian', $l['station'],
        ]), $this->report['fuel']['records']->all());
        $this->namedTable($s, 1, null, $rows, $header);
        $s->freezePane('A2');
        $s->setAutoFilter($s->calculateWorksheetDimension());
        $this->autosize($s, count($header));
    }

    /**
     * Tulis tabel dengan header tebal & format angka per kolom (1-based). Mengembalikan baris berikutnya.
     */
    private function table(Worksheet $s, int $row, ?string $title, array $header, array $rows, array $formats = []): int
    {
        if ($title) {
            $s->setCellValue("A{$row}", $title)->getStyle("A{$row}")->getFont()->setBold(true);
            $row++;
        }
        $last = Coordinate::stringFromColumnIndex(count($header));
        $s->fromArray($header, null, "A{$row}");
        $s->getStyle("A{$row}:{$last}{$row}")->getFont()->setBold(true);
        $s->getStyle("A{$row}:{$last}{$row}")->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('E5E7EB');

        $start = $row + 1;
        if ($rows) {
            $s->fromArray($rows, null, "A{$start}", true);
        }
        $end = $start + max(count($rows), 1) - 1;
        foreach ($formats as $col => $code) {
            $c = Coordinate::stringFromColumnIndex($col);
            $s->getStyle("{$c}{$start}:{$c}{$end}")->getNumberFormat()->setFormatCode($code);
        }

        return $end + 2;
    }

    private function autosize(Worksheet $s, int $cols): void
    {
        for ($i = 1; $i <= $cols; $i++) {
            $s->getColumnDimension(Coordinate::stringFromColumnIndex($i))->setAutoSize(true);
        }
    }
}
