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
    public function next(?CarbonImmutable $now = null): Collection
    {
        $tz = config('cerebro.timezone');
        $now = ($now ?? CarbonImmutable::now())->setTimezone($tz)->locale('es');
        $wanted = config('cerebro.calls.slots_shown');
        $slots = collect();

        for ($day = $now->startOfDay(); $slots->count() < $wanted && $day->diffInDays($now->startOfDay(), true) < 14; $day = $day->addDay()) {
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

                $slots->push([
                    'id' => $start->format('Y-m-d\TH:i'),
                    'start' => $start->toIso8601String(),
                    'end' => $end->toIso8601String(),
                    'now' => $start->lte($now),
                    'label' => $this->label($start, $end, $now),
                ]);
            }
        }

        return $slots->take($wanted)->values();
    }

    public function find(string $id, ?CarbonImmutable $now = null): ?array
    {
        return $this->next($now)->firstWhere('id', $id);
    }

    public function label(CarbonImmutable $start, CarbonImmutable $end, CarbonImmutable $now): string
    {
        if ($start->lte($now)) {
            return 'Ahora (en los próximos minutos)';
        }

        $day = match (true) {
            $start->isSameDay($now) => 'Hoy',
            $start->isSameDay($now->addDay()) => 'Mañana',
            default => ucfirst($start->isoFormat('dddd D')),
        };

        return sprintf('%s · %s – %s (%s)', $day, $start->format('g:i a'), $end->format('g:i a'), config('cerebro.calls.timezone_label'));
    }
}
