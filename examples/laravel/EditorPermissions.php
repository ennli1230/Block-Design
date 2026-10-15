<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Contracts\Auth\Access\Authorizable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;

/** Integration example: Spatie permissions are checked through Laravel Gate.
 * The PagePolicy must independently enforce site/tenant and record ownership.
 * No package installation, role assignment or database change happens here.
 */
final class EditorPermissions
{
    public static function forPage(Authorizable $user, Model $page): array
    {
        $update = Gate::forUser($user)->allows('update', $page);
        return [
            'save' => $update && $user->can('editor.pages.edit'),
            'styles' => $update && $user->can('editor.layout.manage'),
            'design' => $update && $user->can('editor.layout.manage'),
            'import' => $update && $user->can('editor.layout.manage'),
            'catalogWrite' => $update && $user->can('editor.catalog.manage'),
            'export' => Gate::forUser($user)->allows('view', $page) && $user->can('editor.pages.export'),
        ];
    }
}
