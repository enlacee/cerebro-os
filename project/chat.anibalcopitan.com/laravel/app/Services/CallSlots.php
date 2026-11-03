<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class CallSlots
{
    /**
     * Próximas franjas libres para llamar (solo días y horas configurados).
     *
     * @return Collection<int, array{id: string, start: string, end: string, now: bool, label: string}>
     */
    public function next(?CarbonImmutable $now = null, ?int $count = null): Collection
    {
        $tz = config('cerebro.timezone');
        $now = ($now ?? CarbonImmutable::now())->setTimezone($tz);
        $wanted = min($count ?? config('cerebro.calls.slots_shown'), config('cerebro.calls.slots_max'));
        $slots = collect();

        for ($day = $now->startOfDay(); $slots->count() < $wanted && $day->diffInDays($now->startOfDay(), true) < 21; $day = $day->addDay()) {
            if (! in_array($day->dayOfWeekIso, config('cerebro.calls.days'), true)) {
                continue;
            }

            foreach (config('cerebro.calls.windows') as [$from, $to]) {
                $start = $day->setTimeFromTimeString($from);
                $end = $day->setTimeFromTimeString($to);

                // Una franja ya empezada solo vale si le quedan al menos 10 minutos.
                if ($end->lte($now->addMinutes(10))) {
                    continue;
                }

                $inProgress = $start->lte($now);
                $slots->push([
                    'id' => $start->format('Y-m-d\TH:i'),
                    'start' => $start->toIso8601String(),
                    'end' => $end->toIso8601String(),
                    'now' => $inProgress,
                    'label' => $this->label($start, $end, $now).($inProgress ? '' : ' ('.config('cerebro.calls.timezone_label').')'),
                ]);
            }
        }

        return $slots->take($wanted)->values();
    }

    /** Busca entre todas las franjas que el widget puede mostrar (incluidas las extra). */
    public function find(string $id, ?CarbonImmutable $now = null): ?array
    {
        return $this->next($now, config('cerebro.calls.slots_max'))->firstWhere('id', $id);
    }

    /** "Mañana · 11:00 am – 12:00 pm" en la zona horaria indicada (por defecto, la del negocio). */
    public function label(CarbonImmutable $start, CarbonImmutable $end, CarbonImmutable $now, ?string $tz = null): string
    {
        $tz ??= config('cerebro.timezone');
        $start = $start->setTimezone($tz)->locale('es');
        $end = $end->setTimezone($tz);
        $now = $now->setTimezone($tz);

        if ($start->lte($now)) {
            return 'Ahora (en los próximos minutos)';
        }

        $day = match (true) {
            $start->isSameDay($now) => 'Hoy',
            $start->isSameDay($now->addDay()) => 'Mañana',
            default => ucfirst($start->isoFormat('dddd D')),
        };

        return sprintf('%s · %s – %s', $day, $start->format('g:i a'), $end->format('g:i a'));
    }

    /** ¿El visitante tiene la misma hora que el negocio en ese momento? */
    public function sameTime(string $tz, CarbonImmutable $at): bool
    {
        return $at->setTimezone($tz)->utcOffset() === $at->setTimezone(config('cerebro.timezone'))->utcOffset();
    }
}
