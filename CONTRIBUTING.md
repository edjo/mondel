# Contributing to Mondel

Thank you for your interest in contributing to Mondel! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/yourusername/mondel.git
cd mondel
```

2. **Install dependencies**

```bash
npm install
```

3. **Start development**

```bash
npm run dev
```

4. **Run tests**

```bash
npm test
```

## Project Structure

```
mondel/
├── src/
│   ├── schema/        # Schema definition and builders
│   ├── manager/       # Manager class and collection proxy
│   ├── validation/    # Zod integration
│   ├── types/         # TypeScript type definitions
│   └── index.ts       # Public exports
├── tests/             # Test files
└── examples/          # Usage examples
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
npm run lint
npm run format
```

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for high test coverage

```bash
npm test
npm run test:coverage
```

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
