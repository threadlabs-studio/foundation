export interface ValidationIssue {
  readonly code:
    | 'duplicate_id'
    | 'invalid_anchor'
    | 'invalid_path'
    | 'invalid_review_date'
    | 'invalid_type'
    | 'required'
    | 'unknown_dependency'
    | 'unsupported_schema';
  readonly path: string;
  readonly message: string;
}

export const EXIT_CODES = {
  success: 0,
  findings: 1,
  invalidInput: 2,
  staleOrConflict: 3,
  unavailableEvidence: 4,
  canceled: 5,
  mutationFailed: 6,
} as const;

export type ExitClass = keyof typeof EXIT_CODES;

export class ThreadlabsError extends Error {
  public constructor(
    message: string,
    public readonly exitClass: ExitClass,
    public readonly details: readonly ValidationIssue[] = [],
  ) {
    super(message);
    this.name = 'ThreadlabsError';
  }
}

export function validationIssue(
  code: ValidationIssue['code'],
  path: string,
  message: string,
): ValidationIssue {
  return { code, path, message };
}
