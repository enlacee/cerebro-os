<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Symfony\Component\Finder\SplFileInfo;

class Knowledge
{
    /**
     * Junta todos los .md de la carpeta de conocimiento en un solo archivo compilado.
     *
     * @return array{files: list<string>, words: int, tokens: int}
     */
    public function compile(): array
    {
        $path = config('cerebro.knowledge.path');

        if (! File::isDirectory($path)) {
            throw new RuntimeException("No existe la carpeta de conocimiento: {$path}");
        }

        $exclude = config('cerebro.knowledge.exclude');
        $first = config('cerebro.knowledge.first');

        $files = collect(File::allFiles($path))
            ->filter(fn (SplFileInfo $file) => $file->getExtension() === 'md')
            ->map(fn (SplFileInfo $file) => $file->getRelativePathname())
            ->reject(fn (string $name) => in_array($name, $exclude, true))
            ->sortBy(fn (string $name) => [
                array_search($name, $first, true) === false ? PHP_INT_MAX : array_search($name, $first, true),
                $name,
            ])
            ->values();

        $content = $files
            ->map(fn (string $name) => "<archivo ruta=\"{$name}\">\n".trim(File::get("{$path}/{$name}"))."\n</archivo>")
            ->implode("\n\n");

        File::ensureDirectoryExists(dirname(config('cerebro.knowledge.compiled')));
        File::put(config('cerebro.knowledge.compiled'), $content);

        $words = count(preg_split('/\s+/u', trim($content)));

        return [
            'files' => $files->all(),
            'words' => $words,
            // Estimación gruesa para español: ~1.6 tokens por palabra.
            'tokens' => (int) round($words * 1.6),
        ];
    }

    public function systemPrompt(): string
    {
        $compiled = config('cerebro.knowledge.compiled');

        if (! File::exists($compiled)) {
            $this->compile();
        }

        return strtr(File::get(resource_path('prompts/sistema.md')), [
            '{negocio}' => config('cerebro.business_name'),
            '{fecha}' => now(config('cerebro.timezone'))->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY'),
            '{conocimiento}' => File::get($compiled),
        ]);
    }
}
