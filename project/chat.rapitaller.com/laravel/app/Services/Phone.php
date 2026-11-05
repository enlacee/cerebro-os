<?php

namespace App\Services;

/**
 * Celular con código de país: lo limpia, lo valida y lo deja listo para llamar.
 * Reglas por país en cerebro.widget.call.phones (las mismas que usa el widget).
 */
class Phone
{
    /**
     * @return array{digits: string, pretty: string}|string  número listo o el mensaje de error
     */
    public static function parse(string $code, string $number): array|string
    {
        $code = preg_replace('/\D/', '', $code);
        $national = preg_replace('/\D/', '', $number);

        if ($code === '' || strlen($code) > 3) {
            return 'Revisa el código de país (ej. +51).';
        }

        // Si repitió el código en el número (+51 51987…) o puso el 0 de larga distancia (0987…).
        $rule = config("cerebro.widget.call.phones.{$code}");
        $max = $rule ? max($rule['digits']) : 13;
        if (str_starts_with($national, $code) && strlen($national) > $max) {
            $national = substr($national, strlen($code));
        }
        $national = ltrim($national, '0');

        if ($rule) {
            $ok = in_array(strlen($national), $rule['digits'], true)
                && ($rule['starts'] === '' || str_contains($rule['starts'], $national[0] ?? '-'));

            if (! $ok) {
                return self::hint($rule);
            }
        } elseif (strlen($national) < 6 || strlen($code.$national) > 15) {
            return 'Revisa tu número de WhatsApp.';
        }

        return ['digits' => $code.$national, 'pretty' => '+'.$code.' '.self::group($national)];
    }

    /**
     * Número completo en un solo texto ("+51 987 654 321"): toma el código conocido más largo.
     *
     * @return array{digits: string, pretty: string}|string
     */
    public static function parseFull(string $full): array|string
    {
        $digits = preg_replace('/\D/', '', $full);
        $codes = array_map('strval', array_keys(config('cerebro.widget.call.phones', [])));
        usort($codes, fn ($a, $b) => strlen($b) <=> strlen($a));

        foreach ($codes as $code) {
            if (str_starts_with($digits, $code)) {
                return self::parse($code, substr($digits, strlen($code)));
            }
        }

        return strlen($digits) >= 8 && strlen($digits) <= 15
            ? ['digits' => $digits, 'pretty' => '+'.$digits]
            : 'Revisa tu número de WhatsApp (con código de país).';
    }

    // "Tu celular debe tener 9 dígitos y empezar con 9."
    private static function hint(array $rule): string
    {
        $digits = implode(' u ', $rule['digits']);
        $starts = $rule['starts'] === '' ? '' : ' y empezar con '.implode(' o ', str_split($rule['starts']));

        return "Tu celular debe tener {$digits} dígitos{$starts}.";
    }

    // En grupos para leerlo y marcarlo fácil: 987 654 321 · 300 123 4567 · 7123 4567.
    public static function group(string $digits): string
    {
        $sizes = [8 => [4, 4], 9 => [3, 3, 3], 10 => [3, 3, 4], 11 => [3, 4, 4]][strlen($digits)] ?? null;
        if (! $sizes) {
            return trim(chunk_split($digits, 3, ' '));
        }

        $parts = [];
        foreach ($sizes as $size) {
            $parts[] = substr($digits, 0, $size);
            $digits = substr($digits, $size);
        }

        return implode(' ', $parts);
    }
}
