# Contributing to Mondel

Thank you for your interest in contributing to Mondel! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/edjo/mondel.git
cd mondel
```

2. **Install dependencies**

```bash
npm install
```

3. **Start development**

```bash
# Build the library
npm run build

# Run tests
npm test

# Start documentation server
npm run docs:dev
```

## Project Structure

```
mondel/
├── src/
│   ├── client/        # Main client API (createClient)
│   ├── schema/        # Schema definition and builders
│   ├── manager/       # Collection proxy (internal)
│   ├── validation/    # Zod integration
│   ├── types/         # TypeScript type definitions
│   └── index.ts       # Public exports
├── docs/              # Documentation site
├── examples/          # Usage examples
└── tests/             # Test files
```

## Coding Guidelines

### TypeScript

- Use strict TypeScript configuration
- Avoid `any` types when possible
- Document public APIs with JSDoc comments
- Use descriptive variable and function names

### Code Style

- Follow the existing code style
- Use Prettier for formatting
- Run ESLint before committing

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## Architecture Notes

### Client-First Design

Mondel uses a client-first architecture:

- `createClient()` is the main entry point
- `CollectionProxy` handles CRUD operations internally
- Old `Manager` API is deprecated and removed

### Type Safety

- All schemas infer TypeScript types automatically
- `_id` is implicit and always included in types
- Field names are validated at compile time

### Serverless Optimization

- Minimal bundle size (~27KB)
- Factory pattern for serverless environments
- No reflection or decorators

## Pull Request Process

1. Create a new branch for your feature/fix
2. Make your changes
3. Write/update tests
4. Update documentation if needed
5. Run tests and linting
6. Submit a pull request

### Commit Messages

Use conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

Example: `feat: add support for partial indexes`

## Reporting Issues

When reporting issues, please include:

- Mondel version
- MongoDB version
- Node.js version
- Minimal reproduction code
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
