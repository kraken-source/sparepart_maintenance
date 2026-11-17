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
        $plate = $f['vehicle'] ? '_'.str_replace(' ', '', $f['vehicle']['plate_number']) : '';

        return "laporan-biaya_{$f['from']}_{$f['to']}{$plate}.xlsx";
    }

    /** Tulis ke file sementara dan kembalikan path-nya. */
    public function store(): string
    {
        $book = new Spreadsheet;
        $book->getProperties()->setTitle('Laporan Biaya Maintenance')->setCreator('Sparepart Maintenance');

        $this->summarySheet($book->getActiveSheet());
        $this->monthlySheet($book->createSheet());
        $this->partSheet($book->createSheet());
        $this->detailSheet($book->createSheet());
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

        $s->setCellValue('A1', 'Laporan Biaya Maintenance')->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $rows = [
            ['Periode', "{$f['from']} s/d {$f['to']}"],
            ['Kendaraan', $f['vehicle'] ? "{$f['vehicle']['plate_number']} – {$f['vehicle']['brand']} {$f['vehicle']['model']}" : 'Semua kendaraan'],
            ['Dibuat', now()->format('Y-m-d H:i')],
            [],
            ['Total biaya', $r['summary']['total']],
            ['Jumlah catatan', $r['summary']['count']],
            ['Jumlah bulan', $r['summary']['months']],
            ['Rata-rata per bulan', $r['summary']['avg_per_month']],
        ];
        $s->fromArray($rows, null, 'A3');
        foreach (['B7', 'B10'] as $c) {
            $s->getStyle($c)->getNumberFormat()->setFormatCode(self::RUPIAH);
        }

        $row = 12;
        $row = $this->table($s, $row, 'Biaya per kategori', ['Kategori', 'Jumlah catatan', 'Total biaya', 'Porsi'],
            array_map(fn ($c) => [$c['category'], $c['count'], $c['total'], $c['share']], $r['by_category']->all()), [3 => self::RUPIAH, 4 => '0.0%']);

        $this->table($s, $row + 1, 'Biaya per kendaraan', ['Plat', 'Kendaraan', 'Jumlah catatan', 'Total biaya', 'Porsi'],
            array_map(fn ($v) => [$v['plate_number'], $v['name'], $v['count'], $v['total'], $v['share']], $r['by_vehicle']->all()), [4 => self::RUPIAH, 5 => '0.0%']);

        $this->autosize($s, 5);
    }

    private function monthlySheet(Worksheet $s): void
    {
        $s->setTitle('Per Bulan');
        $cats = $this->report['categories']->all();
        $rows = array_map(
            fn ($m) => array_merge([$m['label'], $m['count']], array_map(fn ($c) => $m['by_category'][$c] ?? 0, $cats), [$m['total']]),
            $this->report['monthly'],
        );
        $rupiah = [];
        for ($i = 3; $i <= count($cats) + 3; $i++) {
            $rupiah[$i] = self::RUPIAH;
        }
        $this->table($s, 1, null, array_merge(['Bulan', 'Jumlah catatan'], $cats, ['Total']), $rows, $rupiah);
        $this->autosize($s, count($cats) + 3);
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
        $rows = array_map(fn ($r) => [
            $r['service_date'], $r['plate_number'], $r['part'], $r['category'], self::ACTIONS[$r['action']] ?? $r['action'],
            $r['odometer'], $r['part_brand'], $r['workshop'], $r['cost'],
        ], $this->report['records']->all());
        $this->table($s, 1, null, ['Tanggal', 'Plat', 'Part', 'Kategori', 'Tindakan', 'Odometer (km)', 'Merek part', 'Bengkel', 'Biaya'], $rows, [6 => '#,##0', 9 => self::RUPIAH]);
        $s->freezePane('A2');
        $s->setAutoFilter($s->calculateWorksheetDimension());
        $this->autosize($s, 9);
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
