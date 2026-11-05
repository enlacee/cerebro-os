<?php

namespace App\Services;

/**
 * Nombre con formato: "juan carlos PÉREZ" → "Juan Carlos Pérez", "maría DE LA cruz" → "María de la Cruz".
 * La misma regla aplica el widget al salir del campo.
 */
class Name
{
    // Partículas que van en minúscula (salvo al inicio).
    private const PARTICLES = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'];

    public static function format(string $name): string
    {
        $words = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY);

        return implode(' ', array_map(function (string $word, int $i) {
            $lower = mb_strtolower($word);
            if ($i > 0 && in_array($lower, self::PARTICLES, true)) {
                return $lower;
            }

            // Cada parte tras un guion o apóstrofo también: Ana-María, O'Brien.
            return preg_replace_callback("/(^|[-'’])(\\p{L})/u", fn ($m) => $m[1].mb_strtoupper($m[2]), $lower);
        }, $words, array_keys($words)));
    }
}
