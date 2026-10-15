import type {
  AdapterError,
  FieldDefinition,
  JsonValue,
} from "@blockdesign/contracts";

export function validateFieldValue(
  field: FieldDefinition,
  value: JsonValue | undefined,
  path: string,
): AdapterError[] {
  if (value === undefined || value === null || value === "") {
    return field.required
      ? [
          {
            code: "FIELD_REQUIRED",
            message: `“${field.label}” alanını doldur.`,
            path,
            recoverable: true,
          },
        ]
      : [];
  }
  const isText = [
    "text",
    "textarea",
    "richText",
    "url",
    "image",
    "video",
    "color",
    "select",
  ].includes(field.type);
  if (isText && typeof value !== "string")
    return [
      {
        code: "FIELD_TYPE_INVALID",
        message: `“${field.label}” bir metin olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    field.type === "number" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    return [
      {
        code: "FIELD_TYPE_INVALID",
        message: `“${field.label}” geçerli bir sayı olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (field.type === "boolean" && typeof value !== "boolean")
    return [
      {
        code: "FIELD_TYPE_INVALID",
        message: `“${field.label}” açık veya kapalı olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    ["url", "image", "video"].includes(field.type) &&
    typeof value === "string" &&
    value &&
    !isSafeUrl(value)
  )
    return [
      {
        code: "UNSAFE_URL",
        message: `“${field.label}” adresi güvenli bir web adresi olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    field.type === "color" &&
    typeof value === "string" &&
    !/^#[0-9a-f]{3,8}$/i.test(value) &&
    !/^(?:rgb|hsl)a?\([\d\s.,%+-]+\)$/i.test(value)
  )
    return [
      {
        code: "COLOR_INVALID",
        message: `“${field.label}” geçerli bir renk olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    typeof value === "string" &&
    field.min !== undefined &&
    value.length < field.min
  )
    return [
      {
        code: "FIELD_TOO_SHORT",
        message: `“${field.label}” en az ${field.min} karakter olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    typeof value === "string" &&
    field.max !== undefined &&
    value.length > field.max
  )
    return [
      {
        code: "FIELD_TOO_LONG",
        message: `“${field.label}” en fazla ${field.max} karakter olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (typeof value === "number" && field.min !== undefined && value < field.min)
    return [
      {
        code: "FIELD_TOO_SMALL",
        message: `“${field.label}” en az ${field.min} olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (typeof value === "number" && field.max !== undefined && value > field.max)
    return [
      {
        code: "FIELD_TOO_LARGE",
        message: `“${field.label}” en fazla ${field.max} olmalı.`,
        path,
        recoverable: true,
      },
    ];
  if (
    field.type === "select" &&
    field.options &&
    typeof value === "string" &&
    !field.options.some((option) => option.value === value)
  )
    return [
      {
        code: "OPTION_INVALID",
        message: `“${field.label}” seçeneği geçerli değil.`,
        path,
        recoverable: true,
      },
    ];
  return [];
}

export function isSafeUrl(value: string): boolean {
  if (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../")
  )
    return !value.startsWith("//");
  try {
    const protocol = new URL(value, "https://local.invalid").protocol;
    return (
      protocol === "http:" ||
      protocol === "https:" ||
      protocol === "mailto:" ||
      protocol === "tel:"
    );
  } catch {
    return false;
  }
}
