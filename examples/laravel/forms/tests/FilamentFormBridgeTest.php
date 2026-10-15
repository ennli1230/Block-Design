<?php

namespace BlockDesign\Forms\Tests;

use BlockDesign\Forms\FilamentFormBridge;
use Filament\Forms\Components\{Select, TextInput};
use Filament\Schemas\Schema;
use Orchestra\Testbench\TestCase;

final class FilamentFormBridgeTest extends TestCase
{
    public function test_exports_a_schema_from_the_same_filament_fields(): void
    {
        $fields = Schema::make()->components([TextInput::make('email')->label('E-posta')->email()->required()->maxLength(200), Select::make('destination')->label('Destinasyon')->options(['efes' => 'Efes'])])->getComponents();
        $result = (new FilamentFormBridge)->definition('contact', '1.0.0', 'İletişim', $fields);
        $this->assertSame('email', $result['fields'][0]['type']);
        $this->assertTrue($result['fields'][0]['validation']['required']);
        $this->assertSame(200, $result['fields'][0]['validation']['maxLength']);
        $this->assertSame([['value' => 'efes', 'label' => 'Efes']], $result['fields'][1]['options']);
    }

    public function test_requires_an_explicit_provider_for_dynamic_options(): void
    {
        $fields = Schema::make()->components([Select::make('tour')->options(fn () => ['efes' => 'Efes'])])->getComponents();
        $this->expectException(\InvalidArgumentException::class);
        (new FilamentFormBridge)->definition('travel', '1', 'Talep', $fields);
    }
}
