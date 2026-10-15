<?php

declare(strict_types=1);

namespace BlockDesign\Forms;

use Illuminate\Database\QueryException;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Support\Facades\{DB, Validator};
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class FormController
{
    public function __construct(private readonly FormRegistry $forms) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['items' => $this->forms->catalog($request), 'nextCursor' => null]);
    }

    public function show(Request $request, string $id, string $version): JsonResponse
    {
        return response()->json($this->forms->definition($id, $version, $request));
    }

    public function submit(Request $request, string $id, string $version): JsonResponse
    {
        $validator = Validator::make($request->all(), ['providerId' => 'required|string', 'formRef.id' => 'required|string', 'formRef.version' => 'required|string', 'actionId' => 'required|string', 'kind' => 'required|in:submit,search', 'values' => 'present|array', 'context' => 'present|array', 'submissionId' => 'required|uuid']);
        if ($validator->fails()) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => 'Geçersiz form isteği.'], 422);
        }
        // Registry must authorize this exact form and server-derived actor scope.
        $definition = $this->forms->definition($id, $version, $request);
        if ($definition['ref'] !== ['id' => $id, 'version' => $version]) {
            return response()->json(['kind' => 'schemaChanged', 'message' => 'Form sürümü değişti. Sayfayı yenileyin.'], 409);
        }
        if ($request->input('providerId') !== $this->forms->providerId() || $request->input('formRef.id') !== $id || $request->input('formRef.version') !== $version || $request->input('actionId') !== $definition['action']['actionId'] || $request->input('kind') !== $definition['action']['kind'] || $request->header('Idempotency-Key') !== $request->input('submissionId')) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => 'Form işlemi eşleşmiyor.'], 422);
        }
        $values = $request->input('values');
        if (array_filter($values, fn ($value) => ! is_scalar($value) && $value !== null)) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => 'Alan değerleri geçersiz.'], 422);
        }
        $context = $request->input('context');
        if (array_filter($context, fn ($value) => ! is_scalar($value))) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => 'Bağlam değerleri geçersiz.'], 422);
        }
        ksort($values); ksort($context);
        $fingerprint = hash('sha256', json_encode([$values, $context, $id, $version, $definition['action']['actionId']], JSON_THROW_ON_ERROR));
        $key = hash('sha256', json_encode([$this->forms->scope($request), $id, $version, $request->input('submissionId')], JSON_THROW_ON_ERROR));
        $existing = DB::table('blockdesign_form_receipts')->where('id', $key)->first();
        if ($existing) return $this->replay($existing, $fingerprint);
        try {
            $validated = $this->forms->validate($id, $version, $values, $request);
            $result = DB::transaction(function () use ($key, $fingerprint, $validated, $context, $id, $version, $request) {
                // Reserve a unique receipt before performing any business write.
                DB::table('blockdesign_form_receipts')->insert(['id' => $key, 'fingerprint' => $fingerprint, 'result' => null, 'created_at' => now()]);
                $result = $this->forms->execute($id, $version, $validated, $context, $request);
                if (! in_array($result['kind'] ?? '', ['accepted', 'redirect'], true)) throw new InvalidArgumentException('The registry must return accepted or redirect.');
                if ($result['kind'] === 'accepted' && ! is_string($result['receiptId'] ?? null) || $result['kind'] === 'redirect' && ! is_string($result['url'] ?? null)) throw new InvalidArgumentException('Invalid form action result.');
                DB::table('blockdesign_form_receipts')->where('id', $key)->update(['result' => json_encode($result, JSON_THROW_ON_ERROR)]);
                return $result;
            });
            return response()->json($result);
        } catch (ValidationException $error) {
            // FilamentFormBridge uses stable field names, including dotted paths.
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) $error->errors()], 422);
        } catch (InvalidArgumentException $error) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => $error->getMessage()], 422);
        } catch (QueryException $error) {
            $receipt = DB::table('blockdesign_form_receipts')->where('id', $key)->first();
            if ($receipt) return $this->replay($receipt, $fingerprint);
            throw $error;
        }
    }

    private function replay(object $receipt, string $fingerprint): JsonResponse
    {
        if (! hash_equals($receipt->fingerprint, $fingerprint)) {
            return response()->json(['kind' => 'validationError', 'fieldErrors' => (object) [], 'message' => 'İşlem kimliği farklı veriyle kullanıldı.'], 409);
        }
        return response()->json(json_decode($receipt->result, true, 512, JSON_THROW_ON_ERROR));
    }
}
