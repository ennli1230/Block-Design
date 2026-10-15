<?php

declare(strict_types=1);

namespace BlockDesign\Forms;

use Illuminate\Http\Request;

/** The host implements tenant/form authorization and invokes its Filament field factory. */
interface FormRegistry
{
    public function providerId(): string;
    public function catalog(Request $request): array;
    public function definition(string $id, string $version, Request $request): array;
    public function validate(string $id, string $version, array $values, Request $request): array;
    /** DB writes only; schedule external side effects after the enclosing transaction commits. */
    public function execute(string $id, string $version, array $validated, array $context, Request $request): array;
    /** Server-derived tenant/actor scope; never use the submitted context for authorization. */
    public function scope(Request $request): string;
}
