<?php

declare(strict_types=1);

namespace BlockDesign\Forms;

use Filament\Forms\Components\{Checkbox, DatePicker, Field, Radio, Select, Textarea, TextInput};
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;

/** Flat public forms only. Native validation remains on Laravel's side. */
final class FilamentFormBridge
{
    /** @param array<Field> $fields Already attached to the host's Filament Schema. */
    public function definition(string $id, string $version, string $label, array $fields, array $optionSources = [], string $locale = 'tr', string $kind = 'submit'): array
    {
        $seen = [];
        $exported = [];
        foreach ($fields as $field) {
            if (! $field instanceof Field) {
                throw new InvalidArgumentException('Only flat, supported Filament fields can be exported.');
            }
            if ($field->isHidden() || $field->isDisabled() || $field instanceof Select && $field->isMultiple()) {
                throw new InvalidArgumentException('Hidden, disabled or multiple-value fields require an explicit adapter.');
            }
            $name = $field->getName();
            if (! preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/', $name) || isset($seen[$name]) || in_array($name, ['__proto__', 'constructor', 'prototype'], true)) {
                throw new InvalidArgumentException('Field names must be stable and unique.');
            }
            $seen[$name] = true;
            $type = match (true) {
                $field instanceof Select => 'select',
                $field instanceof Radio => 'radio',
                $field instanceof Checkbox => 'checkbox',
                $field instanceof DatePicker => 'date',
                $field instanceof Textarea => 'textarea',
                $field instanceof TextInput => $field->getType(),
                default => throw new InvalidArgumentException('Unsupported field: '.$field::class),
            };
            if (! in_array($type, ['text', 'email', 'tel', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox'], true)) {
                throw new InvalidArgumentException('Unsupported public field type: '.$type);
            }
            $validation = ['required' => $field->isRequired()];
            foreach (['getMinLength' => 'minLength', 'getMaxLength' => 'maxLength', 'getMinValue' => 'min', 'getMaxValue' => 'max'] as $method => $rule) {
                if (method_exists($field, $method) && ($value = $field->$method()) !== null) {
                    $validation[$rule] = $value;
                }
            }
            $item = ['fieldId' => $name, 'type' => $type, 'label' => strip_tags((string) $field->getLabel()), 'validation' => $validation];
            if (method_exists($field, 'getPlaceholder') && $field->getPlaceholder() !== null) {
                $item['placeholder'] = strip_tags((string) $field->getPlaceholder());
            }
            if ($field->getHelperText() !== null) {
                $item['help'] = strip_tags((string) $field->getHelperText());
            }
            if (in_array($type, ['select', 'radio'], true)) {
                if (isset($optionSources[$name])) {
                    $item['options'] = $optionSources[$name];
                } else {
                    if ($field->hasDynamicOptions()) {
                        throw new InvalidArgumentException('Dynamic options require an explicit content-provider mapping: '.$name);
                    }
                    $item['options'] = [];
                    foreach ($field->getOptions() as $value => $optionLabel) {
                        if (! is_scalar($optionLabel)) {
                            throw new InvalidArgumentException('Grouped option lists need an explicit adapter.');
                        }
                        $item['options'][] = ['value' => (string) $value, 'label' => (string) $optionLabel];
                    }
                }
            }
            // Model state/default closures are deliberately not exported as public data.
            $exported[] = $item;
        }
        return ['ref' => ['id' => $id, 'version' => $version], 'label' => $label, 'locale' => $locale, 'fields' => $exported,
            'action' => ['adapterId' => 'laravel', 'actionId' => $id, 'kind' => $kind, 'label' => $kind === 'search' ? 'Ara' : 'Gönder']];
    }

    /** Use the very same trusted Filament field factory, resolved with submitted state. */
    public function validate(array $fields, array $values): array
    {
        $data = [];
        $rules = [];
        $allowed = [];
        foreach ($fields as $field) {
            $name = $field->getName();
            $allowed[] = $name;
            Arr::set($data, $name, $values[$name] ?? null);
            $rules[$name] = $field->getValidationRules();
        }
        if (array_diff(array_keys($values), $allowed)) {
            throw new InvalidArgumentException('Unknown visitor fields.');
        }
        return Validator::make($data, $rules)->validate();
    }
}
