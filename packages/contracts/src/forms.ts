import type {
  Capability,
  ContentProviderAdapter,
  PageResult,
  RequestContext,
  VersionRef,
} from "./index.ts";

export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox";
export type FormValue = string | number | boolean | null;
export type FormValues = Record<string, FormValue>;
export interface FormOption {
  value: string;
  label: string;
}
export interface FormOptionSource {
  providerId: string;
  collectionId: string;
  labelField: string;
  valueField?: string;
  dependencies?: Array<{ fieldId: string; filterField: string }>;
  searchable?: boolean;
}
export interface FormField {
  fieldId: string;
  type: FormFieldType;
  label: string;
  help?: string;
  placeholder?: string;
  defaultValue?: FormValue;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number | string;
    max?: number | string;
  };
  options?: FormOption[] | FormOptionSource;
  layout?: { group?: string; span?: 1 | 2 };
}
export interface FormSummary {
  ref: VersionRef;
  label: string;
}
export interface FormDefinition extends FormSummary {
  locale: string;
  fields: FormField[];
  action: {
    adapterId: string;
    actionId: string;
    kind: "submit" | "search";
    label: string;
  };
  layout?: { columns: 1 | 2 };
}
export interface FormContextBinding {
  key: string;
  value: string | number | boolean;
}
export interface FormBinding {
  providerId: string;
  formRef: VersionRef;
  appearance: "stacked" | "inline-search";
  contextBindings: FormContextBinding[];
}
export interface FormProviderAdapter {
  readonly providerId: string;
  readonly capabilities: Capability;
  listForms(
    context?: RequestContext,
    cursor?: string,
  ): Promise<PageResult<FormSummary>>;
  getDefinition(
    ref: VersionRef,
    context?: RequestContext,
  ): Promise<FormDefinition>;
}
export interface FormActionRequest {
  providerId: string;
  formRef: VersionRef;
  actionId: string;
  kind: "submit" | "search";
  values: FormValues;
  context: Record<string, string | number | boolean>;
  submissionId: string;
}
export type FormActionResult =
  | { kind: "accepted"; receiptId: string; message?: string }
  | {
      kind: "validationError";
      fieldErrors: Record<string, string[]>;
      message?: string;
    }
  | { kind: "schemaChanged"; message: string; currentRef?: VersionRef }
  | { kind: "redirect"; url: string };
export interface FormActionAdapter {
  readonly adapterId: string;
  readonly capabilities: Capability;
  execute(
    input: FormActionRequest,
    context?: RequestContext,
  ): Promise<FormActionResult>;
}
/** Explicit public HTTP configuration for exported forms. Never include headers/tokens. */
export interface FormPublicationConfig {
  messages?: Record<string,string>;
  schemaBaseUrl: string;
  actionBaseUrl: string;
  contentBaseUrl?: string;
}
export interface FormRuntimeOptions {
  messages?: Record<string,string>;
  providers: FormProviderAdapter[];
  actions?: FormActionAdapter[];
  contentProviders?: ContentProviderAdapter[];
  context?: RequestContext;
  mode: "editor" | "preview" | "published";
  /** Preview always simulates unless the host explicitly enables this. */
  allowPreviewSubmission?: boolean;
  publication?: FormPublicationConfig;
  navigate?: (url: string) => void;
}
