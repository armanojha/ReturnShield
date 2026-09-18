export class RepositoryError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class RepositoryConflictError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConflictError';
  }
}

export class RepositoryValidationError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryValidationError';
  }
}
